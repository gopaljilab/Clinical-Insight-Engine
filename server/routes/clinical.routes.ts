import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireVerified } from "../auth";
import { MLService } from "../services/mlService";
import { logger } from "../logger";

const clinicalRouter = Router();

const clinicalAnalyzeSchema = z.object({
  text: z.string({
    required_error: "Text input is required",
    invalid_type_error: "Text input must be a string",
  }).min(1, "Text input cannot be empty"),
});

clinicalRouter.post(
  "/analyze",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const validation = clinicalAnalyzeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: validation.error.errors[0]?.message ?? "Invalid input format.",
        });
      }

      const { text } = validation.data;
      
      // Perform extraction through the Python daemon MLService pipeline
      // This is secure and doesn't log the raw clinical text to stdout/stderr.
      const { result } = await MLService.runClinicalAnalysis(text);
      
      // Secure log (Privacy preserving: does not print the raw note or sensitive patient details)
      logger.info({
        event: "clinical_analysis",
        user: req.session.user?.email,
        text_length: text.length,
        symptoms_count: result.symptoms.length,
        medications_count: result.medications.length,
        model: result.model_name
      }, "Clinical notes analyzed successfully.");

      return res.json({
        symptoms: result.symptoms,
        medications: result.medications,
        model_name: result.model_name
      });
    } catch (err: any) {
      logger.error({ err }, "Error analyzing clinical text");
      return res.status(500).json({
        message: "An error occurred while analyzing the clinical text."
      });
    }
  }
);

export default clinicalRouter;
