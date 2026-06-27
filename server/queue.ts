import { Queue, Worker, Job, BackoffOptions } from "bullmq";
import { storage } from "./storage";
import IORedis from "ioredis";
import { sendCriticalRiskAlert } from "./email";
import { logger } from "./logger";
import { MLService, calculateClinicalFallback } from "./services/mlService";

import { execFile } from "child_process";
import { emitAssessmentProgress, emitAssessmentCompleted, emitAssessmentFailed } from "./socket/assessmentSocket";
import fs from "fs/promises";
import { getPool, withRetry } from "./db";
import path from "path";

function getConfig(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

const QUEUE_MAX_RETRIES = parseInt(getConfig("QUEUE_MAX_RETRIES", "5"), 10);
const QUEUE_BACKOFF_DELAY = parseInt(getConfig("QUEUE_BACKOFF_DELAY", "2000"), 10);
const QUEUE_LOCK_DURATION = parseInt(getConfig("QUEUE_LOCK_DURATION", "30000"), 10);
const QUEUE_STALLED_INTERVAL = parseInt(getConfig("QUEUE_STALLED_INTERVAL", "30000"), 10);
const QUEUE_MAX_STALLED_COUNT = parseInt(getConfig("QUEUE_MAX_STALLED_COUNT", "3"), 10);

const backoff: BackoffOptions = {
  type: "exponential",
  delay: QUEUE_BACKOFF_DELAY,
};

export function getPythonExecutable(): string {
  const candidates =
    process.platform === "win32"
      ? [path.resolve(".venv", "Scripts", "python.exe"), path.resolve("venv", "Scripts", "python.exe")]
      : [path.resolve(".venv", "bin", "python"), path.resolve("venv", "bin", "python")];

  for (const c of candidates) {
    try {
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
      retryStrategy: (times: number) => {
        const delay = Math.min(1000 * Math.pow(2, times - 1), 30000);
        logger.warn({ attempt: times, nextRetryMs: delay }, "Redis reconnection attempt");
        return delay;
      },
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
      defaultJobOptions: {
        attempts: QUEUE_MAX_RETRIES,
        backoff,
        removeOnComplete: { age: 3600 * 24 },
        removeOnFail: { age: 3600 * 24 * 7 },
      },
    });
  }

  return assessmentQueueInstance;
}

export async function getQueueMetrics() {
  const queue = getAssessmentQueue();
  if (!queue) {
    return { available: false };
  }

  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      available: true,
      name: queue.name,
      counts: { waiting, active, completed, failed, delayed },
      workerActive: assessmentWorkerInstance !== null,
      redisConnected: redisConnectionInstance?.status === "ready",
      config: {
        maxRetries: QUEUE_MAX_RETRIES,
        backoffDelayMs: QUEUE_BACKOFF_DELAY,
        lockDurationMs: QUEUE_LOCK_DURATION,
        stalledIntervalMs: QUEUE_STALLED_INTERVAL,
        maxStalledCount: QUEUE_MAX_STALLED_COUNT,
      },
    };
  } catch (err) {
    logger.error({ err }, "Failed to get queue metrics");
    return { available: false, error: String(err) };
  }
}

export function startAssessmentWorker(): void {
  if (!queueAvailable || assessmentWorkerInstance) {
    return;
  }

  assessmentWorkerInstance = new Worker(
    "assessmentQueue",
    async (job: Job) => {
      if (job.name === "predictBatch") {
        const { assessments, userId } = job.data;
        const startedAt = Date.now();
        const requestId = (job.data as any).requestFingerprint ?? job.id;
        
        try {
          emitAssessmentProgress(job.id ?? "", 10, "Validating Batch");
          await new Promise((r) => setTimeout(r, 0)); // yield event loop

          // Process in smaller chunks to avoid memory spikes
          const CHUNK_SIZE = 50;
          const createdAssessments: any[] = [];
          
          for (let i = 0; i < assessments.length; i += CHUNK_SIZE) {
            const chunk = assessments.slice(i, i + CHUNK_SIZE);
            const progress = 10 + Math.floor((i / assessments.length) * 80);
            emitAssessmentProgress(job.id ?? "", progress, `Processing Batch (${i + 1}/${assessments.length})`);
            
            let predictions: any[];
            try {
              const { predictions: batchPredictions } = await MLService.runAssessmentInferenceBatch(chunk);
              predictions = batchPredictions;
            } catch (error) {
              logger.warn({ error }, "Batch prediction failed, using fallback");
              predictions = calculateClinicalFallback(chunk) as any[];
            }

            const chunkCreated = await Promise.all(
              chunk.map(async (assessment: any, index: number) => {
                const prediction = predictions[index];
                const pool = getPool();
                const client = await pool.connect();
                try {
                  await client.query("BEGIN");
                  const result = await client.query(
                    `INSERT INTO assessments (
                      "patientName", "age", "gender", "hypertension", "heartDisease",
                      "smokingHistory", "bmi", "hba1cLevel", "bloodGlucoseLevel",
                      "riskScore", "riskCategory", "factors", "confidenceInterval",
                      "modelConfidence", "createdBy", "userId"
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                    RETURNING *`,
                    [
                      assessment.patientName, assessment.age, assessment.gender, assessment.hypertension,
                      assessment.heartDisease, assessment.smokingHistory, assessment.bmi,
                      assessment.hba1cLevel, assessment.bloodGlucoseLevel,
                      Number(prediction.riskScore),
                      prediction.riskCategory,
                      JSON.stringify(prediction.factors || []),
                      prediction.confidenceInterval ?? null,
                      prediction.modelConfidence == null ? null : Number(prediction.modelConfidence),
                      userId,
                      userId,
                    ]
                  );
                  await client.query("COMMIT");
                  return result.rows[0];
                } catch (err) {
                  await client.query("ROLLBACK").catch(() => {});
                  throw err;
                } finally {
                  client.release();
                }
              })
            );
            createdAssessments.push(...chunkCreated);
          }
          
          logger.info({ jobId: job.id, durationMs: Date.now() - startedAt, count: createdAssessments.length }, "Batch processing completed");
          emitAssessmentProgress(job.id ?? "", 100, "Assessment Complete");
          
          const result = { status: "completed", assessments: createdAssessments };
          emitAssessmentCompleted(job.id ?? "", result);
          return result;
        } catch (err: any) {
          logger.error({ jobId: job.id, requestId, durationMs: Date.now() - startedAt, err }, "Assessment batch failed");
          throw err;
        }
      }

      const { input, userId, userEmail } = job.data;

      const startedAt = Date.now();
      const requestId = (job.data as any).requestFingerprint ?? job.id;

      try {
        emitAssessmentProgress(job.id ?? "", 10, "Data Validation");
      await new Promise((r) => setTimeout(r, 0)); // yield event loop

      emitAssessmentProgress(job.id ?? "", 30, "Feature Preparation");
      const { prediction } = await MLService.runAssessmentInference(input, job.id ?? "", { throwOnFailure: true });
      emitAssessmentProgress(job.id ?? "", 60, "Running Prediction Model");
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

        const assessment = await withRetry(
          "worker.createAssessment",
          async () => {
            const pool = getPool();
            const client = await pool.connect();
            try {
              await client.query("BEGIN");
              const result = await client.query(
                `INSERT INTO assessments (
                  "patientName", "age", "gender", "hypertension", "heartDisease",
                  "smokingHistory", "bmi", "hba1cLevel", "bloodGlucoseLevel",
                  "riskScore", "riskCategory", "factors", "confidenceInterval",
                  "modelConfidence", "createdBy", "userId"
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                RETURNING *`,
                [
                  input.patientName, input.age, input.gender, input.hypertension,
                  input.heartDisease, input.smokingHistory, input.bmi,
                  input.hba1cLevel, input.bloodGlucoseLevel,
                  Number(resolvedPrediction.riskScore),
                  resolvedPrediction.riskCategory,
                  JSON.stringify(resolvedPrediction.factors || []),
                  resolvedPrediction.confidenceInterval ?? null,
                  resolvedPrediction.modelConfidence == null
                    ? null
                    : Number(resolvedPrediction.modelConfidence),
                  userEmail || userId,
                  userId,
                ]
              );
              await client.query("COMMIT");
              return result.rows[0];
            } catch (err) {
              await client.query("ROLLBACK").catch(() => {});
              throw err;
            } finally {
              client.release();
            }
          },
          3,
          500,
          2
        );

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

        emitAssessmentProgress(job.id ?? "", 90, "Generating Results");
        const result = {
          ...assessment,
          prediction: resolvedPrediction,
          requestId,
        };
        emitAssessmentProgress(job.id ?? "", 100, "Assessment Complete");
        emitAssessmentCompleted(job.id ?? "", result);
        return result;
      } catch (err: unknown) {
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
          (err as any).killed ||
          (err as any).signal === "SIGTERM" ||
          (err as Error).message === "Clinical assessment timed out." ||
          (err as Error).message?.includes("timed out")
        ) {
          throw new Error("Clinical assessment generation timed out.");
        }
        throw err;
      }
    },
    {
      connection: getRedisConnection() as any,
      concurrency: 4,
      lockDuration: QUEUE_LOCK_DURATION,
      stalledInterval: QUEUE_STALLED_INTERVAL,
      maxStalledCount: QUEUE_MAX_STALLED_COUNT,
    }
  );

  assessmentWorkerInstance.on("failed", (job: Job | undefined, err: Error) => {
    const attempt = job?.attemptsMade ?? 0;
    logger.error(
      { jobId: job?.id, requestId: job?.data?.requestId, attempt, err },
      `Assessment queue job failed (attempt ${attempt}/${QUEUE_MAX_RETRIES})`,
    );
  });

  assessmentWorkerInstance.on("completed", (job: Job | undefined) => {
    logger.info(
      { jobId: job?.id, requestId: job?.data?.requestId },
      "Assessment queue job completed successfully",
    );
  });

  assessmentWorkerInstance.on("error", (err: Error) => {
    logger.error({ err }, "Assessment worker encountered an error");
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
