import { logger } from "../logger";
import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { requireAuth, requireVerified } from "../auth";
import { api } from "@shared/routes";
import { storage } from "../storage";
import { MLService } from "../services/mlService";
import {
  sanitizeDatabaseError,
  analyzeSearchInput,
  logSecurityEvent,
} from "../security/sqlProtection";
import { searchQuerySchema } from "../validation/searchValidation";
import { canAccessPatientRecord } from "../services/authz/patient-access";
import { logAccessAttempt } from "../security/access-audit";

const assessmentsRouter = Router();

const assessmentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many assessment requests. Please try again later.",
    retryAfter: 60,
  },
});

const previewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many preview requests. Please try again later.",
    retryAfter: 60,
  },
});

assessmentsRouter.post(
  "/preview",
  requireAuth,
  requireVerified,
  previewLimiter,
  async (req, res) => {
    try {
      const input = api.assessments.preview.input.parse(req.body);
      const { prediction } = await MLService.runAssessmentInference(input);

      return res.json({
        riskScore: prediction.riskScore,
        riskCategory: prediction.riskCategory,
        factors: prediction.factors ?? [],
        confidenceInterval: prediction.confidenceInterval ?? null,
        modelConfidence: prediction.modelConfidence ?? null,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      if (err.message === "Clinical assessment timed out." || err.message.includes("timed out")) {
        return res.status(408).json({ message: "Clinical assessment preview timed out." });
      }
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  }
);

assessmentsRouter.post(
  "/",
  requireAuth,
  requireVerified,
  assessmentLimiter,
  async (req, res) => {
    const userId = (req.session.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    let requestFingerprint: string | null = null;

    try {
      const input = api.assessments.create.input.parse(req.body);
      requestFingerprint = MLService.generateRequestFingerprint(input, userId);

      if (MLService.activeInferenceRequests.has(requestFingerprint)) {
        return res.status(409).json({
          message: "An identical assessment request is already being processed.",
        });
      }
      MLService.activeInferenceRequests.add(requestFingerprint);

      const { prediction, isFallback } = await MLService.runAssessmentInference(input);

      prediction.disclaimer =
        "DISCLAIMER: This is a clinical decision support tool and is not a medical diagnosis. Please consult with a healthcare professional for clinical decisions." +
        (isFallback
          ? " (Generated via fallback rule-based clinical support model due to system unavailability)"
          : "");

      const assessment = await storage.createAssessment({
        ...input,
        riskScore: Number(prediction.riskScore),
        riskCategory: prediction.riskCategory,
        factors: prediction.factors,
        confidenceInterval: prediction.confidenceInterval ?? undefined,
        modelConfidence:
          prediction.modelConfidence == null
            ? undefined
            : Number(prediction.modelConfidence),
        createdBy: userId,
      });

      return res.status(201).json({ ...assessment, prediction });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      if (err.message === "Clinical assessment timed out." || err.message.includes("timed out")) {
        return res.status(408).json({ message: "Clinical assessment generation timed out." });
      }
      logger.error("Error creating assessment:", err);
      return res
        .status(500)
        .json({ message: err.message || "Failed to generate clinical assessment." });
    } finally {
      if (requestFingerprint) {
        MLService.activeInferenceRequests.delete(requestFingerprint);
      }
    }
  }
);

assessmentsRouter.get(
  "/",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const userEmail = req.session.user?.email;
      
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit as string) || 20)
      );
      const offset = (page - 1) * limit;
      
      const result = await storage.getAssessments(limit, offset, userEmail);

      res.json(result);
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch assessments" });
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
      return res.json(assessment);
    } catch (err) {
      logger.error({ err }, "Assessment fetch error:");
      const { statusCode, message } = sanitizeDatabaseError(err);
      return res.status(statusCode).json({ message });
    }
  }
);

export default assessmentsRouter;
