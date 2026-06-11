import { Queue, Worker, Job } from "bullmq";
import { storage } from "./storage";
import IORedis from "ioredis";
import { safeExecFile } from "./utils/exec";
import { promisify } from "util";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { sendCriticalRiskAlert } from "./email";
import { logger } from "./logger";

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "analyze.py");



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
      const tempFile = path.join(os.tmpdir(), `${randomUUID()}.json`);

      try {
        await writeFile(tempFile, JSON.stringify(input));
        const stdout = await new Promise<string>((resolve, reject) => {
          const child = safeExecFile(
            getPythonExecutable(),
            [analyzePyPath, "predict_file", tempFile],
            {
              timeout: 60000,
              killSignal: "SIGTERM",
            },
            (error, stdout, stderr) => {
              if (error) {
                reject(error);
              } else {
                resolve(stdout);
              }
            }
          );

          const fallbackTimer = setTimeout(() => {
            try {
              child.kill("SIGKILL");
            } catch (e) {
              // ignore
            }
            reject(new Error("Clinical assessment timed out (forced kill)."));
          }, 65000);

          child.on("close", () => clearTimeout(fallbackTimer));
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
          createdBy: userEmail || userId,
          userId: userId
        });

        if (prediction.riskCategory === "HIGH" && userEmail) {
          const alertSent = await sendCriticalRiskAlert(
            userEmail,
            input.patientName ?? "Unknown Patient",
            Number(prediction.riskScore),
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
      connection: getRedisConnection() as any,
      concurrency: 4,
    }
  );

  assessmentWorkerInstance.on("failed", (job: Job | undefined, err: Error) => {
    logger.error({ jobId: job?.id, err }, "Assessment queue job failed");
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
