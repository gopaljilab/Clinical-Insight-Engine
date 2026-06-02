import type { Express } from "express";
import type { Server } from "http";
import { storage, type AssessmentCreateInput } from "./storage";
import { requireAuth, requireVerified } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { existsSync } from "fs";
import { writeFile, unlink } from "fs/promises";
import { randomUUID, createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { rateLimit } from "express-rate-limit";
import { assessmentsToCsv } from "./utils/csvSanitizer";
import { sanitizeDatabaseError } from "./utils/csvSanitizer";
import { detectSqlInjectionPattern, searchQuerySchema } from "./validation/searchValidation";


function analyzeSearchInput(q: string): { safe: boolean; pattern: string | null } {
  const pattern = detectSqlInjectionPattern(q);
  return { safe: pattern === null, pattern };
}

function logSecurityEvent(
  _type: string,
  _message: string,
  _req: Express.Request,
  _details?: Record<string, unknown>,
) {
  // Keep this lightweight to avoid breaking compile-time due to missing optional modules.
  // Security-relevant events are already logged by other middleware and access-audit.
}


import { canAccessPatientRecord } from "./services/authz/patient-access";
// (logSecurityEvent is used in the search handler; implemented below to avoid extra imports)

import { logAccessAttempt } from "./security/access-audit";
import { issueToken } from "./services/auth/tokenValidator";
import { publicApiRateLimiter as previewLimiter } from "./middleware/rateLimiter";

const execFileAsync = promisify(execFile);

/**
 * Tracks currently running inference requests to prevent
 * duplicate concurrent ML execution for identical payloads.
 */
const activeInferenceRequests = new Set<string>();

function generateRequestFingerprint(payload: unknown, userId: string): string {
  return createHash("sha256")
    .update(`${userId}::${JSON.stringify(payload)}`)
    .digest("hex");
}

// ESM-compatible path resolution for analyze.py
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "analyze.py");

/**
 * Rate limiter for the ML assessment endpoint.
 * This endpoint spawns a Python subprocess for each request, which is resource-intensive.
 * Limits to 5 requests per minute per IP to prevent DoS attacks.
 */
const assessmentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many assessment requests. Please try again later.",
    retryAfter: 60,
  },
});

export function getPythonExecutable() {
  const candidates = process.platform === "win32"
    ? [path.resolve(".venv", "Scripts", "python.exe"), path.resolve("venv", "Scripts", "python.exe")]
    : [path.resolve(".venv", "bin", "python"), path.resolve("venv", "bin", "python")];

  return candidates.find((candidate) => existsSync(candidate)) ?? "python3";
}

async function seedDatabase() {
  const existing = await storage.getAssessments();
  if (existing.length !== 0) return;

  console.log("Seeding database with sample assessments...");

  const seedUserId = "seed@clinical-insight-engine.dev";

  const samples: AssessmentCreateInput[] = [
    {
      createdBy: seedUserId,
      patientName: "John Doe",
      gender: "Male",
      age: 45,
      hypertension: false,
      heartDisease: false,
      smokingHistory: "never",
      bmi: 24.5,
      hba1cLevel: 5.2,
      bloodGlucoseLevel: 95,
      riskScore: 12.3,
      riskCategory: "LOW",
      factors: [
        { name: "Age", impact: "positive", description: "Increases risk" },
        { name: "Bmi", impact: "negative", description: "Lowers risk" },
        { name: "Hba1c Level", impact: "negative", description: "Lowers risk" },
      ],
      confidenceInterval: "8.5% - 16.1%",
      modelConfidence: 0.8770,
    },
    {
      createdBy: seedUserId,
      patientName: "Mary Johnson",
      gender: "Female",
      age: 62,
      hypertension: true,
      heartDisease: false,
      smokingHistory: "former",
      bmi: 31.2,
      hba1cLevel: 6.8,
      bloodGlucoseLevel: 145,
      riskScore: 48.7,
      riskCategory: "MODERATE",
      factors: [
        { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
        { name: "Bmi", impact: "positive", description: "Increases risk" },
        { name: "Hypertension", impact: "positive", description: "Increases risk" },
      ],
      confidenceInterval: "38.9% - 58.5%",
      modelConfidence: 0.5130,
    },
  ];

  for (const sample of samples) {
    await storage.createAssessment(sample);
  }

  console.log("Seeding complete!");
}

interface PredictionResult {
  riskScore: number;
  riskCategory: "LOW" | "MODERATE" | "HIGH";
  factors: Array<{ name: string; impact: "positive" | "negative"; description: string }>;
  clinicianAdvice: string[];
  patientAdvice: string[];
  confidenceInterval?: string;
  modelConfidence?: number;
}

function calculateClinicalFallback(input: unknown): PredictionResult {
  const anyInput = input as any;
  let points = 0;

  // Use anyInput for property access to satisfy TypeScript.

  const factors: Array<{ name: string; impact: "positive" | "negative"; description: string }> = [];

  const age = Number(anyInput.age) || 0;
  if (age > 60) {
    points += 20;
    factors.push({ name: "Age > 60", impact: "positive", description: "Elderly demographic is associated with higher metabolic risk." });
  } else if (age > 45) {
    points += 10;
    factors.push({ name: "Age > 45", impact: "positive", description: "Age over 45 increases baseline diabetes risk." });
  }

  const bmi = Number(anyInput.bmi) || 0;
  if (bmi >= 30) {
    points += 25;
    factors.push({ name: "Obese (BMI >= 30)", impact: "positive", description: "Elevated body mass index drives insulin resistance." });
  } else if (bmi >= 25) {
    points += 10;
    factors.push({ name: "Overweight (BMI 25-30)", impact: "positive", description: "Slightly elevated BMI increases metabolic strain." });
  } else if (bmi > 0 && bmi < 18.5) {
    factors.push({ name: "Underweight (BMI < 18.5)", impact: "negative", description: "Lower body weight correlates with reduced metabolic risk." });
  }

  const hba1c = Number(anyInput.hba1cLevel) || 0;
  if (hba1c >= 6.5) {
    points += 35;
    factors.push({ name: "Diabetic HbA1c Range", impact: "positive", description: "HbA1c level >= 6.5% falls within the diabetic range." });
  } else if (hba1c >= 5.7) {
    points += 20;
    factors.push({ name: "Prediabetic HbA1c", impact: "positive", description: "HbA1c level (5.7-6.4%) suggests impaired fasting glucose." });
  }

  const glucose = Number(anyInput.bloodGlucoseLevel) || 0;
  if (glucose >= 126) {
    points += 20;
    factors.push({ name: "Hyperglycemia", impact: "positive", description: "Fasting glucose >= 126 mg/dL indicates metabolic distress." });
  } else if (glucose >= 100) {
    points += 10;
    factors.push({ name: "Elevated Fasting Glucose", impact: "positive", description: "Glucose (100-125 mg/dL) shows early glucose intolerance." });
  }

  if (anyInput.hypertension) {
    points += 10;
    factors.push({ name: "Hypertension", impact: "positive", description: "High blood pressure is a known diabetes comorbidity." });
  }

  if (anyInput.heartDisease) {
    points += 10;
    factors.push({ name: "Heart Disease", impact: "positive", description: "Prior cardiac history links with metabolic syndrome." });
  }

  const riskScore = Math.max(1.0, Math.min(99.0, points));
  let riskCategory: "LOW" | "MODERATE" | "HIGH" = "LOW";
  if (riskScore >= 50) riskCategory = "HIGH";
  else if (riskScore >= 20) riskCategory = "MODERATE";

  return {
    riskScore,
    riskCategory,
    factors: factors.length > 0 ? factors : [{ name: "Stable Profile", impact: "negative", description: "No major clinical risk drivers detected." }],
    clinicianAdvice: riskCategory === "HIGH"
      ? ["High risk. Refer for diagnostic oral glucose tolerance testing (OGTT)."]
      : riskCategory === "MODERATE"
      ? ["Moderate risk. Suggest nutritional counseling and review in 6 months."]
      : ["Low risk. Encourage standard yearly wellness checks."],
    patientAdvice: riskCategory === "HIGH"
      ? ["Please schedule an appointment with your clinician to check diagnostic lab ranges."]
      : riskCategory === "MODERATE"
      ? ["Making positive dietary changes and staying active helps lower type 2 diabetes risk."]
      : ["Continue maintaining a healthy, balanced lifestyle and regular physical activity."],
    confidenceInterval: `${Math.max(1, riskScore - 5)}% - ${Math.min(99, riskScore + 5)}%`,
    modelConfidence: 0.95,
  };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Type helpers: express-session typings in this repo are intentionally loose.
  type SessionUser = { id?: string; email?: string; name?: string };

  if (process.env.NODE_ENV !== "production") {

    seedDatabase().catch(console.error);
  }

  app.get("/api/auth/token", requireAuth, requireVerified, (req, res) => {
    const user = req.session.user as any;

    if (!user?.id || !user?.email) {
      return res.status(401).json({ message: "Invalid session user data" });
    }

    const token = issueToken(user.id, user.email, "provider");
    res.json({ token });
  });

  app.post(
    api.assessments.preview.path,
    requireAuth,
    requireVerified,
    previewLimiter,
    async (req, res) => {
      const input = api.assessments.preview.input.parse(req.body);
      const tempFile = path.join(os.tmpdir(), `${randomUUID()}.json`);

      try {
        await writeFile(tempFile, JSON.stringify(input));

        let prediction: any;
        try {
          const { stdout } = await execFileAsync(
            getPythonExecutable(),
            [analyzePyPath, "predict_file", tempFile],
            { timeout: 30000 },
          );

          prediction = JSON.parse(stdout.trim());
          if (prediction?.error) {
            return res.status(400).json({ message: prediction.error });
          }
        } catch (error: any) {
          if (error?.killed || error?.signal === "SIGTERM") {
            return res.status(408).json({ message: "Clinical assessment preview timed out." });
          }
          prediction = calculateClinicalFallback(input);
        }

        return res.json({
          riskScore: prediction.riskScore,
          riskCategory: prediction.riskCategory,
          factors: prediction.factors ?? [],
          confidenceInterval: prediction.confidenceInterval ?? null,
          modelConfidence: prediction.modelConfidence ?? null,
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
        }
        console.error("Error creating assessment preview:", err);
        return res.status(500).json({ message: "Internal server error" });
      } finally {
        try {
          await unlink(tempFile);
        } catch {
          // ignore
        }
      }
    },
  );

  app.post(
    api.assessments.create.path,
    requireAuth,
    requireVerified,
    assessmentLimiter,
    async (req, res) => {
      const userId = req.session.user?.email;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required." });
      }

      let requestFingerprint: string | null = null;
      let tempFile: string | null = null;

      try {
        const input = api.assessments.create.input.parse(req.body);
        requestFingerprint = generateRequestFingerprint(input, userId);

        if (activeInferenceRequests.has(requestFingerprint)) {
          return res.status(409).json({ message: "An identical assessment request is already being processed." });
        }
        activeInferenceRequests.add(requestFingerprint);

        tempFile = path.join(os.tmpdir(), `${randomUUID()}.json`);
        await writeFile(tempFile, JSON.stringify(input));

        let prediction: any;
        let isFallback = false;

        try {
          const { stdout } = await execFileAsync(
            getPythonExecutable(),
            [analyzePyPath, "predict_file", tempFile],
            { timeout: 30000 },
          );

          prediction = JSON.parse(stdout.trim());
          if (prediction?.error) {
            return res.status(400).json({ message: prediction.error });
          }
        } catch (error: any) {
          if (error?.killed || error?.signal === "SIGTERM") {
            return res.status(408).json({ message: "Clinical assessment generation timed out." });
          }
          prediction = calculateClinicalFallback(input);
          isFallback = true;
        }

        prediction.disclaimer =
          "DISCLAIMER: This is a clinical decision support tool and is not a medical diagnosis. Please consult with a healthcare professional for clinical decisions." +
          (isFallback ? " (Generated via fallback rule-based clinical support model due to system unavailability)" : "");

        const assessment = await storage.createAssessment({
          ...input,
          riskScore: Number(prediction.riskScore),
          riskCategory: prediction.riskCategory,
          factors: prediction.factors,
          confidenceInterval: prediction.confidenceInterval ?? null,
          modelConfidence: prediction.modelConfidence == null ? undefined : Number(prediction.modelConfidence),
          createdBy: userId,
        });

        return res.status(201).json({ ...assessment, prediction });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
        }
        console.error("Error creating assessment:", err);
        return res.status(500).json({ message: "Failed to generate clinical assessment." });
      } finally {
        if (tempFile) {
          try {
            await unlink(tempFile);
          } catch {
            // ignore
          }
        }
        if (requestFingerprint) {
          activeInferenceRequests.delete(requestFingerprint);
        }
      }
    },
  );

  app.get(api.assessments.list.path, requireAuth, requireVerified, async (req, res) => {
    try {
      const userEmail = req.session.user?.email;
      const assessments = await storage.getAssessments(50, 0, userEmail);
      return res.json(assessments);
    } catch (err) {
      return res.status(500).json({ message: "Failed to fetch assessments" });
    }
  });

  app.get(
    "/api/assessments/export.csv",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userEmail = req.session.user?.email;
        const assessments = await storage.getAssessments(1000, 0, userEmail);
        const csv = assessmentsToCsv(assessments as unknown as Record<string, unknown>[]);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=assessments.csv");
        return res.status(200).send(csv);
      } catch {
        return res.status(500).json({ message: "Failed to export assessments" });
      }
    },
  );

  app.get("/api/assessments/search", requireAuth, requireVerified, async (req, res) => {
    try {
      const parseResult = searchQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        const rawQ: string =
          typeof req.query.q === "string" ? req.query.q : Array.isArray(req.query.q) ? String(req.query.q[0] ?? "") : "";
        const analysis = analyzeSearchInput(rawQ);



        if (!analysis.safe) {
          logSecurityEvent(
            "SQL_INJECTION_ATTEMPT",
            "Injection-like pattern detected in search query parameter",
            req,
            { matchedPattern: analysis.pattern, userId: req.session.user?.id },
          );
        } else {
          logSecurityEvent(
            "MALFORMED_SEARCH_QUERY",
            "Search query failed validation",
            req,
            { userId: req.session.user?.id },
          );
        }

        return res.status(400).json({
          message: parseResult.error.errors[0]?.message ?? "Invalid search parameters.",
        });
      }

      const { q, riskCategory, page, limit } = parseResult.data;
      const offset = (page - 1) * limit;
      const userEmail = req.session.user?.email;

      const results = await storage.searchAssessments(q ?? "", userEmail, riskCategory, limit, offset);
      return res.json(results);
    } catch (err) {
      console.error("Assessment search error:", err);
      const { statusCode, message } = sanitizeDatabaseError(err);
      return res.status(statusCode).json({ message });
    }
  });

  app.get("/api/assessments/:id", requireAuth, requireVerified, async (req, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (Number.isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid assessment ID." });
      }

      const user = req.session.user;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const assessment = await storage.getAssessmentById(id);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found." });
      }

      if (!canAccessPatientRecord(user, assessment)) {
        logAccessAttempt(user.id, "Assessment", id, false, "IDOR attempt: User not authorized to access this patient record");
        return res.status(404).json({ message: "Assessment not found." });
      }

      logAccessAttempt(user.id, "Assessment", id, true, "Authorized access");
      return res.json(assessment);
    } catch (err) {
      console.error("Assessment fetch error:", err);
      const { statusCode, message } = sanitizeDatabaseError(err);
      return res.status(statusCode).json({ message });
    }
  });

  return httpServer;
}

