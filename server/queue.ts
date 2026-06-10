import { Queue, Worker, Job } from "bullmq";
import { storage } from "./storage";
import IORedis from "ioredis";
import { spawn, execFile } from "child_process";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { writeFile, unlink, readdir, mkdir } from "fs/promises";
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

export function getAssessmentQueue(): Queue {
  if (!isQueueAvailable()) {
    throw new Error("Assessment queue is not available");
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

      const stdout = await new Promise<string>((resolve, reject) => {
        const python = getPythonExecutable();
        const child = spawn(python, [analyzePyPath, "predict_file"], {
          timeout: 60000,
          killSignal: "SIGTERM",
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdoutData = "";
        let stderrData = "";

        child.stdout.on("data", (data: Buffer) => { stdoutData += data.toString(); });
        child.stderr.on("data", (data: Buffer) => { stderrData += data.toString(); });

        child.on("error", (err) => { reject(err); });

        const fallbackTimer = setTimeout(() => {
          try { child.kill("SIGKILL"); } catch { }
          reject(new Error("Clinical assessment timed out (forced kill)."));
        }, 65000);

        child.on("close", (code) => {
          clearTimeout(fallbackTimer);
          if (code === 0) {
            resolve(stdoutData.trim());
          } else {
            reject(new Error(stderrData.trim() || `Process exited with code ${code}`));
          }
        });

        child.stdin.write(JSON.stringify(input));
        child.stdin.end();
      });

      const prediction = JSON.parse(stdout);
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

const ML_TEMP_DIR = process.env.ML_TEMP_DIR || path.join(os.tmpdir(), "clinical-insight-ml");
const ML_TEMP_CLEANUP_AGE_MINUTES = parseInt(process.env.ML_TEMP_CLEANUP_AGE_MINUTES || "15", 10);

export async function cleanupOrphanedTempFiles(): Promise<number> {
  try {
    const dir = ML_TEMP_DIR;
    if (!existsSync(dir)) return 0;
    const files = await readdir(dir);
    const now = Date.now();
    const maxAge = ML_TEMP_CLEANUP_AGE_MINUTES * 60 * 1000;
    let cleaned = 0;
    for (const file of files) {
      try {
        const filePath = path.join(dir, file);
        const stat = await import("fs/promises").then(fs => fs.stat(filePath));
        if (now - stat.mtimeMs > maxAge) {
          await unlink(filePath);
          cleaned++;
        }
      } catch {
      }
    }
    if (cleaned > 0) {
      logger.info({ cleaned, dir }, "Cleaned up orphaned ML temp files");
    }
    return cleaned;
  } catch (err) {
    logger.error({ err }, "Failed to cleanup orphaned ML temp files");
    return 0;
  }
}

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startTempFileCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    cleanupOrphanedTempFiles().catch(() => {});
  }, ML_TEMP_CLEANUP_AGE_MINUTES * 60 * 1000);
  cleanupInterval.unref();
}

export function stopTempFileCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
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
  stopTempFileCleanup();
}
