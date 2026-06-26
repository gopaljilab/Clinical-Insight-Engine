import { Router } from "express";
import { assessmentLimiter, previewLimiter } from "../middleware/rateLimit";
import { requireAuth, requireVerified } from "../auth";
import { validateDTO } from "../middleware/validateDTO";
import { api } from "@shared/routes";

import {
  previewAssessment,
  simulateWhatIf,
  batchWhatIf,
  autoWhatIf,
  createAssessment,
  simulateFallback,
  getPatientTrends,
  getDashboardTrends,
  getJobStatus,
  getAssessments,
  getBiomarkerAlerts,
  searchAssessments,
  autocompleteAssessments,
  getAssessmentById,
  deleteAssessment,
  getCohortStats
} from "../controllers/assessments.controller";
import { storage } from "../storage";
import sanitizeHtml from "sanitize-html";
import { canAccessPatientRecord, logAccessAttempt } from "../auth";
import { logger } from "../logger";

const assessmentsRouter = Router();

assessmentsRouter.post(
  "/preview",
  requireAuth,
  requireVerified,
  previewLimiter,
  validateDTO(api.assessments.preview.input),
  previewAssessment
);

assessmentsRouter.post(
  "/what-if",
  requireAuth,
  requireVerified,
  previewLimiter,
  validateDTO(api.assessments.simulate.input),
  simulateWhatIf
);

assessmentsRouter.post(
  "/what-if/batch",
  requireAuth,
  requireVerified,
  async (req, res) => {
    const tempFile = path.join(os.tmpdir(), `${randomUUID()}.json`);
    try {
      const parsed = api.assessments.whatIfBatch.input.parse(req.body);
      const { original, perturbations } = parsed;

      if (!isPythonAvailable) {
        const originalResult = calculateClinicalFallback(original) as PredictionResult;
        const perturbationResults = perturbations
          .map((p: any) => {
            const variant = { ...original, ...p };
            const variantResult = calculateClinicalFallback(variant) as PredictionResult;
            const riskReduction = originalResult.riskScore - variantResult.riskScore;
            const desc = Object.keys(p)
              .map((k) => `${k}:${(original as any)[k] ?? "?"}->${(p as any)[k]}`)
              .join("; ");
            return {
              delta: desc,
              riskScore: variantResult.riskScore,
              riskCategory: variantResult.riskCategory,
              factors: variantResult.factors ?? [],
              riskReduction: Number(riskReduction.toFixed(1)),
              confidenceInterval: variantResult.confidenceInterval,
              modelConfidence: variantResult.modelConfidence,
            };
          })
          .sort((a: any, b: any) => b.riskReduction - a.riskReduction);

        return res.json({
          original: originalResult,
          perturbations: perturbationResults,
          ranked: perturbationResults,
          isFallback: true,
        });
      }

      const payload = { original, perturbations };
      await writeFile(tempFile, JSON.stringify(payload));

      const stdout = await new Promise<string>((resolve, reject) => {
        const child = execFile(
          getPythonExecutable(),
          [analyzePyPath, "counterfactual", tempFile],
          { timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
          (error: any, stdout: string, stderr: string) => {
            if (error) reject(error);
            else resolve(stdout);
          }
        );

        if (child.stdin) {
          child.stdin.on("error", (err: any) => {
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
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      logger.error({ err }, "What-if batch analysis failed");
      return res.status(500).json({ message: "What-if batch analysis failed. Please try again." });
    } finally {
      try {
        await unlink(tempFile);
      } catch { }
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
          (error: any, stdout: string, stderr: string) => {
            if (error) reject(error);
            else resolve(stdout);
          }
        );

        if (child.stdin) {
          child.stdin.on("error", (err: any) => {
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
    } catch (err: unknown) {
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
    const userId = req.session.user?.id;
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

      // --- Redis available: use async queue ---
      if (queue) {
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
      }

      // --- Redis unavailable: run synchronously using clinical fallback ---
      logger.warn("Redis unavailable — running assessment synchronously via clinical fallback");

      const prediction = calculateClinicalFallback(input) as PredictionResult;

      const assessment = await storage.createAssessment({
        patientName: input.patientName,
        age: input.age,
        gender: input.gender,
        hypertension: input.hypertension ?? false,
        heartDisease: input.heartDisease ?? false,
        smokingHistory: input.smokingHistory,
        bmi: input.bmi,
        hba1cLevel: input.hba1cLevel,
        bloodGlucoseLevel: input.bloodGlucoseLevel,
        insulin: input.insulin ?? null,
        skinThickness: input.skinThickness ?? null,
        riskScore: prediction.riskScore,
        riskCategory: prediction.riskCategory as "LOW" | "MODERATE" | "HIGH",
        factors: prediction.factors ?? [],
        confidenceInterval: prediction.confidenceInterval ?? null,
        modelConfidence: prediction.modelConfidence ?? null,
        createdBy: userEmail,
      });


      logger.info(
        `[AUDIT] assessment created synchronously by=${userEmail} riskCategory=${prediction.riskCategory} riskScore=${prediction.riskScore} at=${new Date().toISOString()}`
      );

      return res.status(201).json({
        message: "Assessment completed successfully.",
        assessment,
        isFallback: true,
      });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: err.errors[0]?.message ?? "Invalid input data" });
      }
      logger.error({ err }, "Assessment creation error:");
      return res
        .status(500)
        .json({ message: "Failed to create assessment." });
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
  simulateFallback
);

assessmentsRouter.get(
  "/patient/:patientName/trends",
  requireAuth,
  requireVerified,
  getPatientTrends
);

assessmentsRouter.get(
  "/trends/dashboard",
  requireAuth,
  requireVerified,
  getDashboardTrends
);

assessmentsRouter.get(
  "/jobs/:id",
  requireAuth,
  requireVerified,
  getJobStatus
);

assessmentsRouter.get(
  "/",
  requireAuth,
  requireVerified,
  getAssessments
);

assessmentsRouter.get(
  "/biomarker-alerts",
  requireAuth,
  requireVerified,
  getBiomarkerAlerts
);

assessmentsRouter.get(
  "/search",
  requireAuth,
  requireVerified,
  searchAssessments
);

assessmentsRouter.get(
  "/autocomplete",
  requireAuth,
  requireVerified,
  autocompleteAssessments
);

assessmentsRouter.get(
  "/:id",
  requireAuth,
  requireVerified,
  getAssessmentById
);

assessmentsRouter.patch(
  "/:id/note",
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

      if (!canAccessPatientRecord(user, assessment)) {
        logAccessAttempt(
          user.id,
          "Assessment",
          id,
          false,
          "IDOR attempt: User not authorized to edit notes on this patient record"
        );
        return res.status(403).json({ message: "Forbidden" });
      }

      const { clinicalNote } = req.body;
      if (typeof clinicalNote !== "string") {
        return res.status(400).json({ message: "clinicalNote must be a string." });
      }

      const sanitized = sanitizeHtml(clinicalNote);

      const updated = await storage.updateClinicalNote(id, sanitized);
      if (!updated) {
        return res.status(500).json({ message: "Failed to update clinical note." });
      }

      logAccessAttempt(user.id, "Assessment", id, true, "Clinical note updated");
      return res.json({ clinicalNote: updated.clinicalNote });
    } catch (err) {
      logger.error({ err }, "Clinical note update error:");
      return res.status(500).json({ message: "Failed to update clinical note." });
    }
  }
);

assessmentsRouter.delete(
  "/:id",
  requireAuth,
  requireVerified,
  deleteAssessment
);

assessmentsRouter.get(
  "/cohort",
  requireAuth,
  getCohortStats
);

export default assessmentsRouter;
