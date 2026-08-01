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
      return res.status(401).json({ message: "api.errors.authRequired" });
    }

    let requestFingerprint: string | null = null;
    const batchId = randomUUID();

    try {
      const input = req.body.assessments;
      if (!Array.isArray(input) || input.length === 0) {
        return res.status(400).json({ message: "api.errors.assessmentsArrayRequired" });
      }

      requestFingerprint = MLService.generateRequestFingerprint(input, userId);
      if (MLService.activeInferenceRequests.has(requestFingerprint)) {
        return res.status(409).json({ message: "api.errors.bulkProcessing" });
      }

      const { getAssessmentQueue } = await import("../queue");
      const assessmentQueue = getAssessmentQueue();
      if (!assessmentQueue) {
        return res.status(503).json({ message: "api.errors.assessmentQueueUnavailable" });
      }

      const job = await assessmentQueue.add("predictBatch", {
        assessments: input,
        userId,
        userEmail,
        batchId
      });

      return res.status(202).json({ 
        message: "api.messages.bulkRequestAccepted", 
        jobId: job.id, 
        batchId 
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "api.errors.invalidBulkFormat" });
      }
      logger.error({ err, batchId }, "Bulk create error");
      return res.status(500).json({ message: "api.errors.failedToQueueBulk" });
    }
  }
);

export default mlRouter;
