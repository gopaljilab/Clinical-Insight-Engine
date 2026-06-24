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
    const userId = (req.session.user)?.id;
    if (!userId) {
      return res.status(401).json({ message: "api.errors.unauthorized" });
    }

    let requestFingerprint: string | null = null;
    const batchId = randomUUID();

    try {
      const input = req.body.assessments;
      if (!Array.isArray(input) || input.length === 0) {
        return res.status(400).json({ message: "api.errors.assessments_array_required" });
      }

      requestFingerprint = MLService.generateRequestFingerprint(input, userId);
      if (MLService.activeInferenceRequests.has(requestFingerprint)) {
        return res.status(409).json({ message: "api.errors.bulk_request_processing" });
      }
      MLService.activeInferenceRequests.add(requestFingerprint);

      let predictions: any[];
      try {
        const result = await MLService.runAssessmentInferenceBatch(input);
        predictions = result.predictions;
        if (!Array.isArray(predictions)) {
          throw new Error("Expected array of predictions");
        }
      } catch (error: unknown) {
        logger.warn(
          { err: error },
          "Python prediction bulk failed or timed out, running clinical rule-based fallback:"
        );
        predictions = calculateClinicalFallback(input) as PredictionResult[];
      }

      if (predictions.length !== input.length) {
        return res.status(500).json({
          message: "api.errors.prediction_mismatch"
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
            createdBy: userId,
          };
        })
      );

      return res.status(201).json({ count: createdAssessments.length, batchId, assessments: createdAssessments });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "api.errors.invalid_bulk_input" });
      }
      logger.error({ err, batchId }, "Bulk create error");
      return res.status(500).json({ message: "api.errors.generate_bulk_failed" });
    } finally {
      if (requestFingerprint) {
        MLService.activeInferenceRequests.delete(requestFingerprint);
      }
    }
  }
);

export default mlRouter;
