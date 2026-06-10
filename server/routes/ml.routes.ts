import { Router } from "express";
import { logger } from "../logger";
import { z } from "zod";
import path from "path";
import { randomUUID } from "crypto";
import { requireAuth, requireVerified } from "../auth";
import { api } from "@shared/routes";
import { storage } from "../storage";
import { MLService, getPythonExecutable, calculateClinicalFallback } from "../services/mlService";
import { validateDTO } from "../middleware/validateDTO";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { logAccessAttempt } from "../security/access-audit";
import { mlLimiter } from "../middleware/rateLimit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "..", "analyze.py");

const mlRouter = Router();

function runMlWithStdin(input: unknown): Promise<string> {
  const python = getPythonExecutable();
  return new Promise<string>((resolve, reject) => {
    const child = spawn(python, [analyzePyPath, "predict_file"], {
      timeout: 60000,
      killSignal: "SIGTERM",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 50 * 1024 * 1024,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });

    child.on("error", (err) => { reject(err); });

    const fallbackTimer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { }
      reject(new Error("Bulk ML processing timed out."));
    }, 65000);

    child.on("close", (code) => {
      clearTimeout(fallbackTimer);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || `Process exited with code ${code}`));
      }
    });

    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

mlRouter.post(
  "/bulk",
  requireAuth,
  requireVerified,
  mlLimiter,
  validateDTO(z.object({ assessments: z.array(api.assessments.create.input) })),
  async (req, res) => {
    const userId = (req.session.user as any)?.id;
    if (!userId) {
      logAccessAttempt("unknown", "BulkAssessment", "batch", false, "Authentication required");
      return res.status(401).json({ message: "Authentication required." });
    }

    let requestFingerprint: string | null = null;

    try {
      const input = req.body.assessments;
      if (!Array.isArray(input) || input.length === 0) {
        return res.status(400).json({ message: "Assessments array is required and must not be empty." });
      }

      requestFingerprint = MLService.generateRequestFingerprint(input, userId);
      if (MLService.activeInferenceRequests.has(requestFingerprint)) {
        logAccessAttempt(userId, "BulkAssessment", requestFingerprint, false, "Duplicate request rejected");
        return res.status(409).json({ message: "Bulk request already processing." });
      }
      MLService.activeInferenceRequests.add(requestFingerprint);

      let predictions: any[];
      try {
        const output = await runMlWithStdin(input);
        predictions = JSON.parse(output);
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

      logAccessAttempt(userId, "BulkAssessment", "batch", true,
        `Created ${createdAssessments.length} assessments`);

      return res.status(201).json({ count: createdAssessments.length, assessments: createdAssessments });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid bulk input data format." });
      }
      logger.error({ err }, "Bulk create error");
      logAccessAttempt(userId || "unknown", "BulkAssessment", "batch", false, "Bulk create failed");
      return res.status(500).json({ message: "Failed to generate bulk assessments." });
    } finally {
      if (requestFingerprint) {
        MLService.activeInferenceRequests.delete(requestFingerprint);
      }
    }
  }
);

export default mlRouter;
