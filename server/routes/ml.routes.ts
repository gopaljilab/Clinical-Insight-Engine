import { Router } from "express";
import { z } from "zod";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { writeFile, unlink } from "fs/promises";
import { requireAuth, requireVerified } from "../auth";
import { api } from "@shared/routes";
import { storage } from "../storage";
import { MLService, getPythonExecutable } from "../services/mlService";
import { validateDTO } from "../middleware/validateDTO";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "..", "analyze.py");

const mlRouter = Router();

mlRouter.post(
  "/bulk",
  requireAuth,
  requireVerified,
  validateDTO(z.object({ assessments: z.array(api.assessments.create.input) })),
  async (req, res) => {
    const userId = (req.session.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required." });
    }

    let tempFilePath: string | null = null;
    let requestFingerprint: string | null = null;

    try {
      const input = req.body.assessments;
      
      requestFingerprint = MLService.generateRequestFingerprint(input, userId);
      if (MLService.activeInferenceRequests.has(requestFingerprint)) {
        return res.status(409).json({ message: "Bulk request already processing." });
      }
      MLService.activeInferenceRequests.add(requestFingerprint);

      tempFilePath = path.join(os.tmpdir(), `bulk_${randomUUID()}.json`);
      await writeFile(tempFilePath, JSON.stringify(input));

      let predictions: any[];
      try {
        const { stdout } = await execFileAsync(
          getPythonExecutable(),
          [analyzePyPath, "predict_file", tempFilePath],
          { timeout: 60000, maxBuffer: 50 * 1024 * 1024 }
        );

        predictions = JSON.parse(stdout.trim());
        if (!Array.isArray(predictions)) {
          throw new Error("Expected array of predictions");
        }
      } catch (error: any) {
        return res.status(500).json({ message: "Bulk ML processing failed or timed out." });
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
      console.error("Bulk create error:", err);
      return res.status(500).json({ message: "Failed to generate bulk assessments." });
    } finally {
      if (tempFilePath) {
        try { await unlink(tempFilePath); } catch {}
      }
      if (requestFingerprint) {
        MLService.activeInferenceRequests.delete(requestFingerprint);
      }
    }
  }
);

export default mlRouter;
