import { logger } from "../logger";
import { getAssessmentQueue } from "../queue";
import { Router } from "express";
import { z } from "zod";
import { assessmentLimiter, previewLimiter } from "../middleware/rateLimit";
import { requireAuth, requireVerified } from "../auth";
import { api } from "@shared/routes";
import { storage } from "../storage";
import { MLService, isPythonAvailable, calculateClinicalFallback, type PredictionResult } from "../services/mlService";


import { generateRecommendations } from "../services/recommendation-engine";
import {
  sanitizeDatabaseError,
  analyzeSearchInput,
  logSecurityEvent,
} from "../security/sqlProtection";
import { searchQuerySchema, assessmentsQuerySchema } from "../validation/searchValidation";
import { canAccessPatientRecord } from "../services/authz/patient-access";
import { logAccessAttempt } from "../security/access-audit";
import { validateDTO } from "../middleware/validateDTO";
import { existsSync } from "fs";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "..", "analyze.py");

function getPythonExecutable() {
  const candidates =
    process.platform === "win32"
      ? [ path.resolve(".venv", "Scripts", "python.exe"), path.resolve("venv", "Scripts", "python.exe") ]
      : [ path.resolve(".venv", "bin", "python"), path.resolve("venv", "bin", "python") ];
  return candidates.find((candidate) => existsSync(candidate)) ?? (process.platform === "win32" ? "python" : "python3");
}

const assessmentsRouter = Router();



assessmentsRouter.post(
  "/preview",
  requireAuth,
  requireVerified,
  previewLimiter,
  validateDTO(api.assessments.preview.input),
  async (req, res) => {
    try {
      const input = req.body;
      const { prediction, isFallback } = await MLService.runAssessmentInference(input);

      return res.json({
        riskScore: prediction.riskScore,
        riskCategory: prediction.riskCategory,
        factors: prediction.factors ?? [],
        confidenceInterval: prediction.confidenceInterval ?? null,
        modelConfidence: prediction.modelConfidence ?? null,
        isFallback,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      if (err.message === "Clinical assessment timed out." || err.message.includes("timed out")) {
        return res.status(503).json({ message: "Clinical assessment preview timed out." });
      }
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  }
);

assessmentsRouter.post(
  "/what-if",
  requireAuth,
  requireVerified,
  previewLimiter,
  validateDTO(api.assessments.simulate.input),
  async (req, res) => {
    try {
      const input = req.body;
      const { prediction, isFallback } = await MLService.runAssessmentInference(input);
      return res.json({
        simulatedRisk: prediction.riskScore,
        riskCategory: prediction.riskCategory as "LOW" | "MODERATE" | "HIGH",
        factors: prediction.factors ?? [],
        confidenceInterval: prediction.confidenceInterval ?? null,
        modelConfidence: prediction.modelConfidence ?? null,
        isFallback,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      if (err.message === "Clinical assessment timed out." || err.message.includes("timed out")) {
        return res.status(503).json({ message: "What-if assessment timed out." });
      }
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  }
);

assessmentsRouter.post(
  "/what-if/batch",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const parsed = api.assessments.whatIfBatch.input.parse(req.body);
      const { original, perturbations } = parsed;

      if (!isPythonAvailable) {
        const originalResult = calculateClinicalFallback(original) as PredictionResult;
        const perturbationResults = perturbations.map((p: any) => {
          const variant = { ...original, ...p };
          const variantResult = calculateClinicalFallback(variant) as PredictionResult;
          const riskReduction = originalResult.riskScore - variantResult.riskScore;
          const desc = Object.keys(p).map(k => `${k}:${(original as any)[k] ?? '?'}->${(p as any)[k]}`).join("; ");
          return {
            delta: desc,
            riskScore: variantResult.riskScore,
            riskCategory: variantResult.riskCategory,
            factors: variantResult.factors ?? [],
            riskReduction: Number(riskReduction.toFixed(1)),
            confidenceInterval: variantResult.confidenceInterval,
            modelConfidence: variantResult.modelConfidence,
          };
        }).sort((a: any, b: any) => b.riskReduction - a.riskReduction);
        
        return res.json({
          original: originalResult,
          perturbations: perturbationResults,
          ranked: perturbationResults,
          isFallback: true
        });
      }

      const payload = { original, perturbations };

      const stdout = await new Promise<string>((resolve, reject) => {
        const child = execFile(
          getPythonExecutable(),
          [analyzePyPath, "counterfactual"],
          { timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
          }
        );

        if (child.stdin) {
          child.stdin.on("error", (err) => {
            logger.error({ err }, "Error writing to python stdin");
          });
          child.stdin.write(JSON.stringify(payload));
          child.stdin.end();
        }
      });

      const result = JSON.parse(stdout.trim());
      if (result?.error) {
        return res.status(400).json({ message: result.error });
      }

      return res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      logger.error({ err }, "What-if batch analysis failed");
      return res.status(500).json({ message: "What-if batch analysis failed. Please try again." });
    }
  }
);

assessmentsRouter.post(
  "/what-if/auto",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const input = api.assessments.create.input.parse(req.body);

      if (!isPythonAvailable) {
        return res.status(503).json({ message: "Python service is required for counterfactual auto analysis." });
      }

      const stdout = await new Promise<string>((resolve, reject) => {
        const child = execFile(
          getPythonExecutable(),
          [analyzePyPath, "counterfactual_auto"],
          { timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
          (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
          }
        );

        if (child.stdin) {
          child.stdin.on("error", (err) => {
            logger.error({ err }, "Error writing to python stdin");
          });
          child.stdin.write(JSON.stringify(input));
          child.stdin.end();
        }
      });

      const result = JSON.parse(stdout.trim());
      if (result?.error) {
        return res.status(400).json({ message: result.error });
      }

      return res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      logger.error({ err }, "What-if auto analysis failed");
      return res.status(500).json({ message: "What-if auto analysis failed. Please try again." });
    }
  }
);

assessmentsRouter.post(
  "/",
  requireAuth,
  requireVerified,
  assessmentLimiter,
  validateDTO(api.assessments.create.input),
  async (req, res) => {
    const userId = (req.session.user as any)?.id;
    const userEmail = req.session.user?.email;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    let requestFingerprint: string | undefined;
    try {
      const input = req.body;
      const requestId = (req as any).id as string | undefined;

      requestFingerprint = MLService.generateRequestFingerprint(input, userId);
      if (MLService.activeInferenceRequests.has(requestFingerprint)) {
        return res.status(409).json({
          message: "An identical assessment request is already being processed.",
        });
      }
      MLService.activeInferenceRequests.add(requestFingerprint);

      const queue = getAssessmentQueue();
      if (!queue) {
        return res.status(503).json({
          message: "Assessment queue is temporarily unavailable.",
        });
      }

      const job = await queue.add("predict", {
        input,
        userId,
        userEmail,
        requestId,
      });

      return res.status(202).json({
        message: "Assessment request accepted and is being processed.",
        jobId: job.id,
        requestId,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: err.errors[0]?.message ?? "Invalid input data" });
      }
      logger.error({ err }, "Assessment creation error:");
      return res
        .status(500)
        .json({ message: "Failed to queue clinical assessment." });
    } finally {
      if (requestFingerprint) {
        MLService.activeInferenceRequests.delete(requestFingerprint);
      }
    }
  }
);

assessmentsRouter.post(
  "/simulate",
  requireAuth,
  requireVerified,
  previewLimiter,
  validateDTO(api.assessments.simulate.input),
  async (req, res) => {
    try {
      const input = req.body;
      let prediction: any;

      try {
        const result = await MLService.runAssessmentInference(input);
        prediction = result.prediction;
      } catch (error: any) {
        if (error.message?.includes("timed out")) {
          return res.status(408).json({ message: "Clinical assessment simulation timed out." });
        }

        logger.warn(
          "Python prediction simulation failed, falling back to clinical rule-based model:",
          error
        );
        prediction = calculateClinicalFallback(input);
      }

      logger.info(
        `[AUDIT] simulate requested by=${req.session.user?.email} riskCategory=${prediction.riskCategory} riskScore=${prediction.riskScore} at=${new Date().toISOString()}`
      );

      return res.json({
        simulatedRisk: prediction.riskScore,
        riskCategory: prediction.riskCategory,
        confidence: prediction.modelConfidence ?? null,
        factorContributions: prediction.factors ?? [],
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      logger.error({ err }, "Error creating assessment simulation");
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

assessmentsRouter.get(
  "/patient/:patientName/trends",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const patientName = Array.isArray(req.params.patientName) ? req.params.patientName[0] : req.params.patientName;
      const result = await storage.getAssessmentsByPatientName(patientName, 100, 0);
      return res.json(result);
    } catch (err) {
      logger.error({ err }, "Patient trends fetch error:");
      return res.status(500).json({ message: "Failed to fetch patient trends." });
    }
  }
);

assessmentsRouter.get("/jobs/:id", requireAuth, requireVerified, async (req, res) => {
  try {
    const queue = getAssessmentQueue();
    if (!queue) {
      return res.json({ status: "failed", error: "Assessment queue is temporarily unavailable." });
    }

    const job = await queue.getJob(req.params.id as string);
    if (!job) {
      return res.json({ status: "failed", error: "Job not found" });
    }
    const state = await job.getState();
    if (state === "completed") {
      return res.json({ status: "completed", result: job.returnvalue });
    } else if (state === "failed") {
      return res.json({ status: "failed", error: job.failedReason || "Unknown failure" });
    } else {
      return res.json({ status: state });
    }
  } catch (err) {
    logger.error({ err }, "Error fetching job status");
    return res.json({ status: "failed", error: "Error fetching job status" });
  }
});

assessmentsRouter.get(
  "/",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const userEmail = req.session.user?.email;
      
      const parseResult = assessmentsQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return res.status(400).json({
          message: parseResult.error.errors[0]?.message ?? "Invalid query parameters.",
        });
      }

      const params = parseResult.data;
      const result = await storage.getAssessments({
        ...params,
        createdBy: userEmail,
      });

      res.json(result);
    } catch (err) {
      logger.error({ err }, "Fetch assessments error:");
      return res.status(500).json({ message: "Failed to fetch assessments" });
    }
  }
);

// Biomarker alerts endpoint
assessmentsRouter.get(
  "/biomarker-alerts",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const userEmail = req.session.user?.email;
      // Retrieve comprehensive history for the user to analyze trends
      const all = await storage.getAssessments(1000, undefined, userEmail);
      const alerts = (await import("../services/biomarker-trend-analyzer")).analyzeBiomarkerTrends({ assessments: all.data, lookback: 12 });
      return res.json({ alerts });
    } catch (err) {
      logger.error({ err }, "Biomarker alert error:");
      return res.status(500).json({ message: "Failed to compute biomarker alerts" });
    }
  }
);


assessmentsRouter.get(
  "/search",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const parseResult = searchQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        const rawQ = typeof req.query.q === "string" ? req.query.q : "";
        const analysis = analyzeSearchInput(rawQ);

        if (!analysis.safe) {
          logSecurityEvent(
            "SQL_INJECTION_ATTEMPT",
            "Injection-like pattern detected in search query parameter",
            req as any,
            {
              matchedPattern: analysis.pattern,
              userId: (req.session.user as any)?.id,
            }
          );
        } else {
          logSecurityEvent(
            "MALFORMED_SEARCH_QUERY",
            "Search query failed validation",
            req as any,
            { userId: (req.session.user as any)?.id }
          );
        }

        return res.status(400).json({
          message:
            parseResult.error.errors[0]?.message ??
            "Invalid search parameters.",
        });
      }

      const { q, riskCategory, cursor, limit } = parseResult.data;
      const offset = cursor ? cursor : 0;
      const userEmail = req.session.user?.email;

      if (q) {
        const analysis = analyzeSearchInput(q);
        if (!analysis.safe) {
          logSecurityEvent(
            "SUSPICIOUS_SEARCH_PATTERN",
            "Validated search term contains a suspicious pattern",
            req as any,
            {
              matchedPattern: analysis.pattern,
              userId: (req.session.user as any)?.id,
            }
          );
        }
      }

      const results = await storage.searchAssessments(
        q ?? "",
        userEmail,
        riskCategory,
        limit,
        offset
      );

      return res.json(results);
    } catch (err) {
      logger.error({ err }, "Assessment search error:");
      const { statusCode, message } = sanitizeDatabaseError(err);
      return res.status(statusCode).json({ message });
    }
  }
);

assessmentsRouter.get(
  "/autocomplete",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      if (!q || q.length < 2) {
        return res.json([]);
      }
      const userEmail = req.session.user?.email;
      const names = await storage.autocompletePatientNames(q, userEmail, 10);
      return res.json(names);
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch autocomplete suggestions" });
    }
  }
);

assessmentsRouter.get(
  "/:id",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid assessment ID." });
      }

      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const assessment = await storage.getAssessmentById(id);

      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found." });
      }

      if (!canAccessPatientRecord(user as any, assessment)) {
        logAccessAttempt(
          (user as any).id,
          "Assessment",
          id,
          false,
          "IDOR attempt: User not authorized to access this patient record"
        );
        return res.status(404).json({ message: "Assessment not found." });
      }

      logAccessAttempt((user as any).id, "Assessment", id, true, "Authorized access");
      const recommendations = generateRecommendations({ ...assessment, riskCategory: assessment.riskCategory });
      return res.json({ ...assessment, recommendations });
    } catch (err) {
      logger.error({ err }, "Assessment fetch error:");
      const { statusCode, message } = sanitizeDatabaseError(err);
      return res.status(statusCode).json({ message });
    }
  }
);

assessmentsRouter.delete(
  "/:id",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);

      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid assessment ID." });
      }

      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const assessment = await storage.getAssessmentById(id);

      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found." });
      }

      if (!canAccessPatientRecord(user as any, assessment)) {
        logAccessAttempt(
          (user as any).id,
          "Assessment",
          id,
          false,
          "IDOR attempt: User not authorized to delete this patient record"
        );
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteAssessment(id);
      
      logAccessAttempt((user as any).id, "Assessment", id, true, "Assessment deleted successfully");
      return res.status(204).send();
    } catch (err) {
      logger.error({ err }, "Assessment delete error:");
      const { statusCode, message } = sanitizeDatabaseError(err);
      return res.status(statusCode).json({ message });
    }
  }
);

export default assessmentsRouter;
