import { createHash, randomUUID } from "crypto";
import { execFile, spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import { writeFile, unlink } from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../logger";
import readline from "readline";

// ESM-compatible path resolution for analyze.py
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "..", "analyze.py");

export class SimpleSemaphore {
  private activeCount = 0;
  private queue: (() => void)[] = [];

  constructor(private maxConcurrency: number) {}

  async acquire(): Promise<() => void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      return () => this.release();
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        resolve(() => this.release());
      });
    });
  }

  release(): void {
    this.activeCount--;
    const next = this.queue.shift();
    if (next) {
      this.activeCount++;
      next();
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

const ML_TIMEOUT_MS = parseInt(process.env.ML_TIMEOUT_MS || "30000", 10);
const maxConcurrency = parseInt(process.env.ML_MAX_CONCURRENCY || "2", 10);
const mlConcurrency = new SimpleSemaphore(maxConcurrency);

/**
 * Tracks currently running inference requests to prevent
 * duplicate concurrent ML execution for identical payloads.
 */
const activeInferenceRequests = new Set<string>();

export function generateRequestFingerprint(payload: unknown, userId: string): string {
  return createHash("sha256")
    .update(`${userId}::${JSON.stringify(payload)}`)
    .digest("hex");
}

export function getPythonExecutable() {
  const candidates =
    process.platform === "win32"
      ? [
          path.resolve(".venv", "Scripts", "python.exe"),
          path.resolve("venv", "Scripts", "python.exe"),
        ]
      : [
          path.resolve(".venv", "bin", "python"),
          path.resolve("venv", "bin", "python"),
        ];

  return candidates.find((candidate) => existsSync(candidate)) ?? "python3";
}

export interface PredictionResult {
  riskScore: number;
  riskCategory: "LOW" | "MODERATE" | "HIGH";
  factors: Array<{
    name: string;
    impact: "positive" | "negative";
    description: string;
  }>;
  clinicianAdvice: string[];
  patientAdvice: string[];
  confidenceInterval?: string;
  modelConfidence?: number;
  error?: string;
  disclaimer?: string;
}

export function calculateClinicalFallback(input: unknown): any {
  if (Array.isArray(input)) {
    return input.map((item) => calculateClinicalFallback(item));
  }
  const anyInput = input as any;
  let points = 0;

  const factors: Array<{
    name: string;
    impact: "positive" | "negative";
    description: string;
  }> = [];

  const age = Number(anyInput.age) || 0;
  if (age > 60) {
    points += 20;
    factors.push({
      name: "Age > 60",
      impact: "positive",
      description: "Elderly demographic is associated with higher metabolic risk.",
    });
  } else if (age > 45) {
    points += 10;
    factors.push({
      name: "Age > 45",
      impact: "positive",
      description: "Age over 45 increases baseline diabetes risk.",
    });
  }

  const bmi = Number(anyInput.bmi) || 0;
  if (bmi >= 30) {
    points += 25;
    factors.push({
      name: "Obese (BMI >= 30)",
      impact: "positive",
      description: "Elevated body mass index drives insulin resistance.",
    });
  } else if (bmi >= 25) {
    points += 10;
    factors.push({
      name: "Overweight (BMI 25-30)",
      impact: "positive",
      description: "Slightly elevated BMI increases metabolic strain.",
    });
  } else if (bmi > 0 && bmi < 18.5) {
    factors.push({
      name: "Underweight (BMI < 18.5)",
      impact: "negative",
      description: "Lower body weight correlates with reduced metabolic risk.",
    });
  }

  const hba1c = Number(anyInput.hba1cLevel) || 0;
  if (hba1c >= 6.5) {
    points += 35;
    factors.push({
      name: "Diabetic HbA1c Range",
      impact: "positive",
      description: "HbA1c level >= 6.5% falls within the diabetic range.",
    });
  } else if (hba1c >= 5.7) {
    points += 20;
    factors.push({
      name: "Prediabetic HbA1c",
      impact: "positive",
      description: "HbA1c level (5.7-6.4%) suggests impaired fasting glucose.",
    });
  }

  const glucose = Number(anyInput.bloodGlucoseLevel) || 0;
  if (glucose >= 126) {
    points += 20;
    factors.push({
      name: "Hyperglycemia",
      impact: "positive",
      description: "Fasting glucose >= 126 mg/dL indicates metabolic distress.",
    });
  } else if (glucose >= 100) {
    points += 10;
    factors.push({
      name: "Elevated Fasting Glucose",
      impact: "positive",
      description: "Glucose (100-125 mg/dL) shows early glucose intolerance.",
    });
  }

  if (anyInput.hypertension) {
    points += 10;
    factors.push({
      name: "Hypertension",
      impact: "positive",
      description: "High blood pressure is a known diabetes comorbidity.",
    });
  }

  if (anyInput.heartDisease) {
    points += 10;
    factors.push({
      name: "Heart Disease",
      impact: "positive",
      description: "Prior cardiac history links with metabolic syndrome.",
    });
  }

  const riskScore = Math.max(1.0, Math.min(99.0, points));
  let riskCategory: "LOW" | "MODERATE" | "HIGH" = "LOW";
  if (riskScore >= 50) riskCategory = "HIGH";
  else if (riskScore >= 20) riskCategory = "MODERATE";

  return {
    riskScore,
    riskCategory,
    factors:
      factors.length > 0
        ? factors
        : [
            {
              name: "Stable Profile",
              impact: "negative",
              description: "No major clinical risk drivers detected.",
            },
          ],
    clinicianAdvice:
      riskCategory === "HIGH"
        ? ["High risk. Refer for diagnostic oral glucose tolerance testing (OGTT)."]
        : riskCategory === "MODERATE"
        ? ["Moderate risk. Suggest nutritional counseling and review in 6 months."]
        : ["Low risk. Encourage standard yearly wellness checks."],
    patientAdvice:
      riskCategory === "HIGH"
        ? ["Please schedule an appointment with your clinician to check diagnostic lab ranges."]
        : riskCategory === "MODERATE"
        ? ["Making positive dietary changes and staying active helps lower type 2 diabetes risk."]
        : ["Continue maintaining a healthy, balanced lifestyle and regular physical activity."],
    confidenceInterval: `${Math.max(1, riskScore - 5)}% - ${Math.min(99, riskScore + 5)}%`,
    modelConfidence: 0.95,
  };
}

interface PendingRequest {
  resolve: (value: PredictionResult) => void;
  reject: (reason: any) => void;
  timeoutId: NodeJS.Timeout;
}

class PythonDaemonManager {
  private process: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private isRestarting = false;

  private init() {
    if (this.process) return;

    logger.info("Starting persistent Python ML daemon...");
    const pythonExe = getPythonExecutable();

    this.process = spawn(pythonExe, [analyzePyPath, "daemon"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.rl = readline.createInterface({
      input: this.process.stdout!,
      terminal: false,
    });

    this.rl.on("line", (line) => {
      try {
        const trimmed = line.trim();
        if (!trimmed) return;
        const response = JSON.parse(trimmed);
        const { requestId, prediction, error } = response;
        if (!requestId) return;

        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          clearTimeout(pending.timeoutId);
          this.pendingRequests.delete(requestId);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(prediction);
          }
        }
      } catch (err) {
        logger.error({ err, line }, "Error parsing daemon stdout line");
      }
    });

    this.process.stderr!.on("data", (data) => {
      logger.error(`Python daemon stderr: ${data.toString()}`);
    });

    const exitHandler = (code: number | null) => {
      logger.warn(`Python daemon exited with code ${code}`);
      this.cleanup();
      this.handleCrash();
    };

    const errorHandler = (err: Error) => {
      logger.error({ err }, "Python daemon process error");
      this.cleanup();
      this.handleCrash();
    };

    this.process.on("close", exitHandler);
    this.process.on("error", errorHandler);
  }

  private cleanup() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    if (this.process) {
      try {
        this.process.kill();
      } catch (e) {}
      this.process = null;
    }
  }

  private handleCrash() {
    if (this.isRestarting) return;
    this.isRestarting = true;

    // Reject all pending requests with a crash error
    const activeRequests = Array.from(this.pendingRequests.entries());
    this.pendingRequests.clear();
    for (const [_, pending] of activeRequests) {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error("Python daemon crashed."));
    }

    // Try to restart after a delay
    setTimeout(() => {
      this.isRestarting = false;
      this.init();
    }, 1000);
  }

  public async predict(input: unknown): Promise<PredictionResult> {
    this.init();

    if (!this.process || !this.process.stdin) {
      throw new Error("Python daemon is not running.");
    }

    const requestId = randomUUID();

    return new Promise<PredictionResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error("Clinical assessment timed out."));
        }
      }, ML_TIMEOUT_MS);

      this.pendingRequests.set(requestId, { resolve, reject, timeoutId });

      const payload = JSON.stringify({ requestId, input });
      this.process!.stdin!.write(payload + "\n", (err) => {
        if (err) {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(requestId);
          reject(err);
        }
      });
    });
  }

  public shutdown() {
    this.cleanup();
    this.pendingRequests.clear();
  }
}

export const pythonDaemon = new PythonDaemonManager();

process.on("exit", () => {
  pythonDaemon.shutdown();
});

export async function runAssessmentInference(input: unknown): Promise<{ prediction: PredictionResult, isFallback: boolean }> {
  const release = await mlConcurrency.acquire();
  try {
    console.log("DEBUG: Calling pythonDaemon.predict with:", input);
    const prediction = await pythonDaemon.predict(input);
    console.log("DEBUG: pythonDaemon.predict returned:", prediction);
    return { prediction, isFallback: false };
  } catch (error: any) {
    console.log("DEBUG: Caught error:", error);
    if (error.message?.includes("timed out")) {
      logger.error({ error: "ML prediction timed out", timeout: ML_TIMEOUT_MS });
      throw new Error("Clinical assessment timed out.");
    }
    
    // Use fallback
    return { prediction: calculateClinicalFallback(input), isFallback: true };
  } finally {
    release();
  }
}

export const MLService = {
  activeInferenceRequests,
  generateRequestFingerprint,
  runAssessmentInference,
};
