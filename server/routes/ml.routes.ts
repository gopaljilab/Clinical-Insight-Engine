import { Router } from "express";
import { logger } from "../logger";
import { z } from "zod";
import { requireAuth, requireVerified } from "../auth";
import { api } from "@shared/routes";
import { storage } from "../storage";
import { MLService, calculateClinicalFallback } from "../services/mlService";
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
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    let requestFingerprint: string | null = null;

    try {
      const input = req.body.assessments;
      
      requestFingerprint = MLService.generateRequestFingerprint(input, userId);
      if (MLService.activeInferenceRequests.has(requestFingerprint)) {
        return res.status(409).json({ message: "Bulk request already processing." });
      }
      MLService.activeInferenceRequests.add(requestFingerprint);

      let predictions: any[];
      try {
        const { prediction } = await MLService.runAssessmentInference(input);
        predictions = prediction as any;
        if (!Array.isArray(predictions)) {
          throw new Error("Expected array of predictions");
        }
      } catch (error: any) {
        logger.warn(
          "Python prediction bulk failed or timed out, running clinical rule-based fallback:",
          error
        );
        predictions = calculateClinicalFallback(input);
      }

      const createdAssessments = await Promise.all(
        input.map((assessment: any, index: number) => {
          const prediction = predictions[index];
          return storage.createAssessment({
            ...assessment,
            riskScore: Number(prediction.riskScore),
            riskCategory: prediction.riskCategory,
            factors: prediction.factors,
            confidenceInterval: prediction.confidenceInterval ?? null,
            modelConfidence: prediction.modelConfidence == null ? undefined : Number(prediction.modelConfidence),
            createdBy: userId,
          });
        })
      );

      return res.status(201).json({ count: createdAssessments.length, assessments: createdAssessments });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bulk input data format. Ensure all rows meet schema requirements." });
      }
      logger.error({ err }, "Bulk create error");
      return res.status(500).json({ message: "Failed to generate bulk assessments." });
    } finally {
      if (requestFingerprint) {
        MLService.activeInferenceRequests.delete(requestFingerprint);
      }
    }
  }
);

export default mlRouter;
