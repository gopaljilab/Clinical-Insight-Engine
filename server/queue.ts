import { Queue, Worker, Job } from "bullmq";
import { storage } from "./storage";
import IORedis from "ioredis";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";

export function getPythonExecutable() {
  const candidates = process.platform === "win32"
    ? [
        path.resolve(".venv", "Scripts", "python.exe"),
        path.resolve("venv", "Scripts", "python.exe")
      ]
    : [
        path.resolve(".venv", "bin", "python"),
        path.resolve("venv", "bin", "python")
      ];

  return candidates.find((candidate) => existsSync(candidate)) ?? "python3";
}
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "analyze.py");

export const redisConnection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const assessmentQueue = new Queue("assessmentQueue", {
  connection: redisConnection,
});

const execFileAsync = promisify(execFile);

export const assessmentWorker = new Worker(
  "assessmentQueue",
  async (job: Job) => {
    const { input, isPreview } = job.data;
    const tempFile = path.join(os.tmpdir(), `${randomUUID()}.json`);

    try {
      await writeFile(tempFile, JSON.stringify(input));
      const { stdout } = await execFileAsync(getPythonExecutable(), [analyzePyPath, "predict_file", tempFile], {
        timeout: 60000,
      });

      const prediction = JSON.parse(stdout.trim());
      if (prediction.error) {
        throw new Error(prediction.error);
      }

      prediction.disclaimer =
          "DISCLAIMER: This is a clinical decision support tool and is not a medical diagnosis. Please consult with a healthcare professional for clinical decisions.";

      const assessment = await storage.createAssessment({
        ...input,
        riskScore: Number(prediction.riskScore),
        riskCategory: prediction.riskCategory,
        factors: prediction.factors,
        confidenceInterval: prediction.confidenceInterval ?? null,
        modelConfidence:
          prediction.modelConfidence == null
            ? undefined
            : Number(prediction.modelConfidence),
        createdBy: userId
      });

      return {
        ...assessment,
        prediction
      };
    } catch (err: any) {
      if (err.killed || err.signal === "SIGTERM") {
        throw new Error("Clinical assessment generation timed out.");
      }
      throw err;
    } finally {
      try {
        await unlink(tempFile);
      } catch (e) {
        // ignore
      }
    }
  },
  {
    connection: redisConnection,
    concurrency: 4,
  }
);

assessmentWorker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed with error ${err.message}`);
});
