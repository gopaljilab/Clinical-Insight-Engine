import { Queue, Worker, Job } from "bullmq";
import { storage } from "./storage";
import IORedis from "ioredis";
import { sendCriticalRiskAlert } from "./email";
import { logger } from "./logger";
import { MLService, calculateClinicalFallback } from "./services/mlService";

import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "analyze.py");

export function getPythonExecutable(): string {
  const candidates =
    process.platform === "win32"
      ? [path.resolve(".venv", "Scripts", "python.exe"), path.resolve("venv", "Scripts", "python.exe")]
      : [path.resolve(".venv", "bin", "python"), path.resolve("venv", "bin", "python")];

  for (const c of candidates) {
    // best-effort; ignore errors
    try {
      // eslint-disable-next-line no-undef
      require("fs").accessSync(c);
      return c;
    } catch {
      // ignore
    }
  }

  return process.platform === "win32" ? "python" : "python3";
}


let redisConnectionInstance: IORedis | null = null;
let assessmentQueueInstance: Queue | null = null;
let assessmentWorkerInstance: Worker | null = null;
let queueAvailable = false;

function getRedisUrl() {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

export function isQueueAvailable(): boolean {
  if (process.env.NODE_ENV === "test") {
    return true;
  }
  return queueAvailable;
}

export function getRedisConnection(): IORedis {
  if (!redisConnectionInstance) {
    redisConnectionInstance = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
    redisConnectionInstance.on("error", (err) => {
      logger.error({ err }, "Redis connection error");
    });
  }
  return redisConnectionInstance;
}

export async function verifyRedisConnection(): Promise<boolean> {
  if (process.env.NODE_ENV === "test") {
    queueAvailable = true;
    return true;
  }

  try {
    const redis = getRedisConnection();
    if (redis.status !== "ready") {
      await redis.connect();
    }
    await redis.ping();
    queueAvailable = true;
    return true;
  } catch (err) {
    logger.warn({ err }, "Redis unavailable — async assessment queue disabled");
    queueAvailable = false;
    return false;
  }
}

export function getAssessmentQueue(): Queue | null {
  if (!isQueueAvailable()) {
    return null;
  }

  if (!assessmentQueueInstance) {
    assessmentQueueInstance = new Queue("assessmentQueue", {
      connection: getRedisConnection() as any,
    });
  }

  return assessmentQueueInstance;
}

export function startAssessmentWorker(): void {
  if (!queueAvailable || assessmentWorkerInstance) {
    return;
  }

  assessmentWorkerInstance = new Worker(
    "assessmentQueue",
    async (job: Job) => {
      const { input, userId, userEmail } = job.data;

      const startedAt = Date.now();
      const requestId = (job.data as any).requestFingerprint ?? job.id;

      try {
        const { prediction } = await MLService.runAssessmentInference(input);
        let resolvedPrediction: any = prediction;

        if (!resolvedPrediction || resolvedPrediction.error) {
          resolvedPrediction = calculateClinicalFallback(input);
        }

        logger.info(
          {
            jobId: job.id,
            requestId,
            durationMs: Date.now() - startedAt,
            riskCategory: resolvedPrediction.riskCategory,
          },
          "Assessment queue ML prediction completed",
        );


        resolvedPrediction.disclaimer =
          "DISCLAIMER: This is a clinical decision support tool and is not a medical diagnosis. Please consult with a healthcare professional for clinical decisions.";

        const assessment = await storage.createAssessment({
          ...input,
          riskScore: Number(resolvedPrediction.riskScore),
          riskCategory: resolvedPrediction.riskCategory,
          factors: resolvedPrediction.factors,
          confidenceInterval: resolvedPrediction.confidenceInterval ?? null,
          modelConfidence:
            resolvedPrediction.modelConfidence == null
              ? undefined
              : Number(resolvedPrediction.modelConfidence),
          createdBy: userEmail || userId,
          userId: userId,
        });

        if (resolvedPrediction.riskCategory === "HIGH" && userEmail) {
          const alertSent = await sendCriticalRiskAlert(
            userEmail,
            input.patientName ?? "Unknown Patient",
            Number(resolvedPrediction.riskScore),
            assessment.id,
          );

          if (!alertSent) {
            logger.error(
              { assessmentId: assessment.id, userEmail },
              "Critical risk alert email failed to send",
            );
          }
        }

        return {
          ...assessment,
          prediction: resolvedPrediction,
          requestId,
        };
      } catch (err: any) {
        logger.error(
          {
            jobId: job.id,
            requestId,
            durationMs: Date.now() - startedAt,
            err,
          },
          "Assessment queue job failed during ML processing",
        );

        if (
          err.killed ||
          err.signal === "SIGTERM" ||
          err.message === "Clinical assessment timed out." ||
          err.message?.includes("timed out")
        ) {
          throw new Error("Clinical assessment generation timed out.");
        }
        throw err;
      }
    },
    {
      connection: getRedisConnection() as any,
      concurrency: 4,
    }
  );

  assessmentWorkerInstance.on("failed", (job: Job | undefined, err: Error) => {
    logger.error({ jobId: job?.id, requestId: job?.data?.requestId, err }, "Assessment queue job failed");
  });
}

export async function closeQueue(): Promise<void> {
  if (assessmentWorkerInstance) {
    try {
      await assessmentWorkerInstance.close();
    } catch (err) {
      logger.error({ err }, "Error closing assessment worker");
    }
    assessmentWorkerInstance = null;
  }

  if (assessmentQueueInstance) {
    try {
      await assessmentQueueInstance.close();
    } catch (err) {
      logger.error({ err }, "Error closing assessment queue");
    }
    assessmentQueueInstance = null;
  }

  if (redisConnectionInstance) {
    try {
      await redisConnectionInstance.quit();
    } catch (err) {
      logger.error({ err }, "Error closing Redis connection");
    }
    redisConnectionInstance = null;
  }

  queueAvailable = false;
}
