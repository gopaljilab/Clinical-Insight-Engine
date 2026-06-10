import { createHash, randomUUID } from "crypto";
import { execFile, spawn } from "child_process";
import { existsSync, constants } from "fs";
import { writeFile, unlink, mkdir, open, chmod } from "fs/promises";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "..", "analyze.py");

const ML_TEMP_DIR = process.env.ML_TEMP_DIR || path.join(os.tmpdir(), "clinical-insight-ml");

async function ensureSecureTempDir(): Promise<string> {
  try {
    await mkdir(ML_TEMP_DIR, { recursive: true, mode: 0o700 });
  } catch {
  }
  return ML_TEMP_DIR;
}

export async function writeSecureTempFile(data: string): Promise<string> {
  const dir = await ensureSecureTempDir();
  const filePath = path.join(dir, `${randomUUID()}.json`);
  const fd = await open(filePath, "wx", 0o600);
  try {
    await fd.writeFile(data, "utf-8");
  } finally {
    await fd.close();
  }
  return filePath;
}

function runMlWithStdin(input: unknown): Promise<string> {
  const python = getPythonExecutable();
  return new Promise<string>((resolve, reject) => {
    const child = spawn(python, [analyzePyPath, "predict_file"], {
      timeout: ML_TIMEOUT_MS,
      killSignal: "SIGTERM",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on("data", (data: Buffer) => { stderr += data.toString(); });

    child.on("error", (err) => { reject(err); });

    const fallbackTimer = setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { }
      reject(new Error("Clinical assessment timed out (forced kill)."));
    }, ML_TIMEOUT_MS + 5000);

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

export function calculateClinicalFallback(input: unknown): PredictionResult {
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

export async function runAssessmentInference(input: unknown): Promise<{ prediction: PredictionResult, isFallback: boolean }> {
  const release = await mlConcurrency.acquire();
  let tempFilePath: string | null = null;

  try {
    let stdout: string;
    try {
      stdout = await runMlWithStdin(input);
    } catch (stdinErr: any) {
      if (stdinErr.message?.includes("timed out") || stdinErr.killed) {
        throw stdinErr;
      }
      tempFilePath = await writeSecureTempFile(JSON.stringify(input));
      stdout = await new Promise<string>((resolve, reject) => {
        const child = execFile(
          getPythonExecutable(),
          [analyzePyPath, "predict_file", tempFilePath],
          {
            timeout: ML_TIMEOUT_MS,
            killSignal: "SIGTERM",
            maxBuffer: 10 * 1024 * 1024,
          },
          (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
          }
        );
        const fallbackTimer = setTimeout(() => {
          try { child.kill("SIGKILL"); } catch { }
          reject(new Error("Clinical assessment timed out (forced kill)."));
        }, ML_TIMEOUT_MS + 5000);
        child.on("close", () => clearTimeout(fallbackTimer));
      });
    }

    const prediction = JSON.parse(stdout.trim());
    if (prediction?.error) {
      throw new Error(prediction.error);
    }
    
    return { prediction, isFallback: false };
  } catch (error: any) {
    if (error?.killed || error?.signal === "SIGTERM" || error.message?.includes("timed out")) {
      logger.error({ error: "ML prediction timed out", timeout: ML_TIMEOUT_MS });
      throw new Error("Clinical assessment timed out.");
    }
    
    return { prediction: calculateClinicalFallback(input), isFallback: true };
  } finally {
    release();
    if (tempFilePath) {
      try { await unlink(tempFilePath); } catch { }
    }
  }
}

export const MLService = {
  activeInferenceRequests,
  generateRequestFingerprint,
  runAssessmentInference,
};
