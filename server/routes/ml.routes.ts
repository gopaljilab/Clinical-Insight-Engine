import { Router } from "express";
import { logger } from "../logger";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireAuth, requireVerified } from "../auth";
import { api } from "@shared/routes";
import { storage } from "../storage";
import { MLService, calculateClinicalFallback, type PredictionResult } from "../services/mlService";
import { validateDTO } from "../middleware/validateDTO";
import { mlLimiter } from "../middleware/rateLimit";

const mlRouter = Router();

mlRouter.post(
  "/bulk",
  requireAuth,
  requireVerified,
  mlLimiter,
  validateDTO(z.object({ assessments: z.array(api.assessments.create.input) })),
  async (req, res) => {
    const userId = (req.session.user as any)?.id;
    const userEmail = req.session.user?.email;
    if (!userId || !userEmail) {
      return res.status(401).json({ message: "Authentication required." });
    }

    let requestFingerprint: string | null = null;
    const batchId = randomUUID();

    try {
      const input = req.body.assessments;
      if (!Array.isArray(input) || input.length === 0) {
        return res.status(400).json({ message: "Assessments array is required and must not be empty." });
      }

      requestFingerprint = MLService.generateRequestFingerprint(input, userId);
      if (MLService.activeInferenceRequests.has(requestFingerprint)) {
        return res.status(409).json({ message: "Bulk request already processing." });
      }

      const { getAssessmentQueue } = await import("../queue");
      const assessmentQueue = getAssessmentQueue();
      if (!assessmentQueue) {
        return res.status(503).json({ message: "Assessment queue is not available." });
      }

      if (predictions.length !== input.length) {
        return res.status(500).json({
          message: "Prediction count mismatch: ML service returned a different number of results than expected."
        });
      }

      const createdAssessments = await storage.createAssessmentsBatch(
        input.map((assessment: any, index: number) => {
          const prediction = predictions[index];
          return {
            ...assessment,
            riskScore: Number(prediction.riskScore),
            riskCategory: prediction.riskCategory,
            factors: prediction.factors,
            confidenceInterval: prediction.confidenceInterval ?? null,
            modelConfidence: prediction.modelConfidence == null ? undefined : Number(prediction.modelConfidence),
            createdBy: userEmail,
          });
            createdBy: userId,
          };
        })
      );

      return res.status(202).json({ 
        message: "Bulk request accepted and is being processed.", 
        jobId: job.id, 
        batchId 
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bulk input data format." });
      }
      logger.error({ err, batchId }, "Bulk create error");
      return res.status(500).json({ message: "Failed to queue bulk assessments." });
    }
  }
);

export default mlRouter;
