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

const execFileAsync = promisify(execFile);

/**
 * Tracks currently running inference requests to prevent
 * duplicate concurrent ML execution for identical payloads.
 */
const activeInferenceRequests = new Set<string>();

function generateRequestFingerprint(
  payload: unknown,
  userId: string,
): string {
  return createHash("sha256")
    .update(`${userId}::${JSON.stringify(payload)}`)
    .digest("hex");
}

// ESM-compatible path resolution for analyze.py
// Resolve relative to this source file, not process.cwd()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "analyze.py");

/**
 * Rate limiter for the ML assessment endpoint.
 * This endpoint spawns a Python subprocess for each request, which is resource-intensive.
 * Limits to 5 requests per minute per IP to prevent DoS attacks.
 */
const assessmentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 5, // 5 requests per IP per window
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many assessment requests. Please try again later.",
    retryAfter: 60, // seconds
  },
});

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

async function seedDatabase() {
  const existing = await storage.getAssessments();

  if (existing.length === 0) {
    console.log("Seeding database with sample assessments...");

    const seedUserId = "seed@clinical-insight-engine.dev";

    const samples: AssessmentCreateInput[] = [
      {
        createdBy: seedUserId,
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
          { name: "Hba1c Level", impact: "negative", description: "Lowers risk" }
        ],
        confidenceInterval: "8.5% - 16.1%",
        modelConfidence: 0.8770,
        
      },
      {
        createdBy: seedUserId,
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
          { name: "Hypertension", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "38.9% - 58.5%",
        modelConfidence: 0.5130,
        
      },
      {
        createdBy: seedUserId,
        gender: "Male",
        age: 58,
        hypertension: true,
        heartDisease: true,
        smokingHistory: "current",
        bmi: 35.8,
        hba1cLevel: 8.2,
        bloodGlucoseLevel: 198,
        riskScore: 76.4,
        riskCategory: "HIGH",
        factors: [
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Blood Glucose Level", impact: "positive", description: "Increases risk" },
          { name: "Heart Disease", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "68.1% - 84.7%",
        modelConfidence: 0.7640,
        
      },
      {
        createdBy: seedUserId,
        gender: "Female",
        age: 22,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 21.0,
        hba1cLevel: 4.8,
        bloodGlucoseLevel: 85,
        riskScore: 1.2,
        riskCategory: "LOW",
        factors: [
          { name: "Hba1c Level", impact: "negative", description: "Lowers risk" },
          { name: "Bmi", impact: "negative", description: "Lowers risk" }
        ],
        confidenceInterval: "0.1% - 2.3%",
        modelConfidence: 0.9880,
        
      },
      {
        createdBy: seedUserId,
        gender: "Male",
        age: 30,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 23.5,
        hba1cLevel: 5.1,
        bloodGlucoseLevel: 90,
        riskScore: 2.1,
        riskCategory: "LOW",
        factors: [
          { name: "Hba1c Level", impact: "negative", description: "Lowers risk" }
        ],
        confidenceInterval: "0.5% - 3.7%",
        modelConfidence: 0.9790,
        
      },
      {
        createdBy: seedUserId,
        gender: "Female",
        age: 35,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "former",
        bmi: 22.0,
        hba1cLevel: 5.3,
        bloodGlucoseLevel: 92,
        riskScore: 3.4,
        riskCategory: "LOW",
        factors: [
          { name: "Hba1c Level", impact: "negative", description: "Lowers risk" }
        ],
        confidenceInterval: "1.1% - 5.7%",
        modelConfidence: 0.9660,
        
      },
      {
        createdBy: seedUserId,
        gender: "Male",
        age: 45,
        hypertension: true,
        heartDisease: false,
        smokingHistory: "former",
        bmi: 27.5,
        hba1cLevel: 5.9,
        bloodGlucoseLevel: 105,
        riskScore: 24.5,
        riskCategory: "MODERATE",
        factors: [
          { name: "Hypertension", impact: "positive", description: "Increases risk" },
          { name: "Bmi", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "16.1% - 32.9%",
        modelConfidence: 0.7550,
        
      },
      {
        createdBy: seedUserId,
        gender: "Female",
        age: 50,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "current",
        bmi: 29.0,
        hba1cLevel: 6.1,
        bloodGlucoseLevel: 110,
        riskScore: 31.2,
        riskCategory: "MODERATE",
        factors: [
          { name: "Bmi", impact: "positive", description: "Increases risk" },
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "22.1% - 40.3%",
        modelConfidence: 0.6880,
        
      },
      {
        createdBy: seedUserId,
        gender: "Male",
        age: 40,
        hypertension: false,
        heartDisease: true,
        smokingHistory: "never",
        bmi: 26.2,
        hba1cLevel: 5.8,
        bloodGlucoseLevel: 102,
        riskScore: 28.7,
        riskCategory: "MODERATE",
        factors: [
          { name: "Heart Disease", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "19.8% - 37.6%",
        modelConfidence: 0.7130,
        
      },
      {
        createdBy: seedUserId,
        gender: "Female",
        age: 65,
        hypertension: true,
        heartDisease: true,
        smokingHistory: "never",
        bmi: 31.5,
        hba1cLevel: 7.2,
        bloodGlucoseLevel: 145,
        riskScore: 78.4,
        riskCategory: "HIGH",
        factors: [
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Heart Disease", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "70.3% - 86.5%",
        modelConfidence: 0.7840,
        
      },
      {
        createdBy: seedUserId,
        gender: "Male",
        age: 72,
        hypertension: true,
        heartDisease: true,
        smokingHistory: "former",
        bmi: 33.0,
        hba1cLevel: 8.1,
        bloodGlucoseLevel: 180,
        riskScore: 92.1,
        riskCategory: "HIGH",
        factors: [
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Age", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "86.8% - 97.4%",
        modelConfidence: 0.9210,
        
      },
      {
        createdBy: seedUserId,
        gender: "Male",
        age: 55,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "current",
        bmi: 35.5,
        hba1cLevel: 6.8,
        bloodGlucoseLevel: 135,
        riskScore: 65.3,
        riskCategory: "HIGH",
        factors: [
          { name: "Bmi", impact: "positive", description: "Increases risk" },
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "56.0% - 74.6%",
        modelConfidence: 0.6530,
        
      },
      {
        createdBy: seedUserId,
        gender: "Female",
        age: 78,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 20.5,
        hba1cLevel: 5.2,
        bloodGlucoseLevel: 88,
        riskScore: 12.4,
        riskCategory: "LOW",
        factors: [
          { name: "Age", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "8.6% - 16.2%",
        modelConfidence: 0.8760,
        
      },
      {
        createdBy: seedUserId,
        gender: "Female",
        age: 28,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 38.2,
        hba1cLevel: 5.8,
        bloodGlucoseLevel: 115,
        riskScore: 22.1,
        riskCategory: "MODERATE",
        factors: [
          { name: "Bmi", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "13.9% - 30.3%",
        modelConfidence: 0.7790,
        
      },
      {
        createdBy: seedUserId,
        gender: "Male",
        age: 33,
        hypertension: true,
        heartDisease: false,
        smokingHistory: "current",
        bmi: 25.8,
        hba1cLevel: 5.6,
        bloodGlucoseLevel: 98,
        riskScore: 20.8,
        riskCategory: "MODERATE",
        factors: [
          { name: "Hypertension", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "12.8% - 28.8%",
        modelConfidence: 0.7920,
        
      },
      {
        createdBy: seedUserId,
        gender: "Male",
        age: 25,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 24.0,
        hba1cLevel: 11.5,
        bloodGlucoseLevel: 310,
        riskScore: 99.8,
        riskCategory: "HIGH",
        factors: [
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Blood Glucose Level", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "99.4% - 100.0%",
        modelConfidence: 0.9980,
        
      },
      {
        createdBy: seedUserId,
        gender: "Female",
        age: 61,
        hypertension: true,
        heartDisease: true,
        smokingHistory: "former",
        bmi: 29.8,
        hba1cLevel: 6.5,
        bloodGlucoseLevel: 128,
        riskScore: 68.2,
        riskCategory: "HIGH",
        factors: [
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Heart Disease", impact: "positive", description: "Increases risk" }
        ],
        confidenceInterval: "59.1% - 77.3%",
        modelConfidence: 0.6820,
        
      }
    ];

    for (const sample of samples) {
      await storage.createAssessment(sample);
    }

    console.log("Seeding complete!");
  }
}

interface PredictionResult {
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
}

function calculateClinicalFallback(input: any): PredictionResult {
  let points = 0;
  const factors: Array<{ name: string; impact: "positive" | "negative"; description: string }> = [];

  const age = Number(input.age) || 0;
  if (age > 60) {
    points += 20;
    factors.push({ name: "Age > 60", impact: "positive", description: "Elderly demographic is associated with higher metabolic risk." });
  } else if (age > 45) {
    points += 10;
    factors.push({ name: "Age > 45", impact: "positive", description: "Age over 45 increases baseline diabetes risk." });
  }

  const bmi = Number(input.bmi) || 0;
  if (bmi >= 30) {
    points += 25;
    factors.push({ name: "Obese (BMI >= 30)", impact: "positive", description: "Elevated body mass index drives insulin resistance." });
  } else if (bmi >= 25) {
    points += 10;
    factors.push({ name: "Overweight (BMI 25-30)", impact: "positive", description: "Slightly elevated BMI increases metabolic strain." });
  } else if (bmi > 0 && bmi < 18.5) {
    factors.push({ name: "Underweight (BMI < 18.5)", impact: "negative", description: "Lower body weight correlates with reduced metabolic risk." });
  }

  const hba1c = Number(input.hba1cLevel) || 0;
  if (hba1c >= 6.5) {
    points += 35;
    factors.push({ name: "Diabetic HbA1c Range", impact: "positive", description: "HbA1c level >= 6.5% falls within the diabetic range." });
  } else if (hba1c >= 5.7) {
    points += 20;
    factors.push({ name: "Prediabetic HbA1c", impact: "positive", description: "HbA1c level (5.7-6.4%) suggests impaired fasting glucose." });
  }

  const glucose = Number(input.bloodGlucoseLevel) || 0;
  if (glucose >= 126) {
    points += 20;
    factors.push({ name: "Hyperglycemia", impact: "positive", description: "Fasting glucose >= 126 mg/dL indicates metabolic distress." });
  } else if (glucose >= 100) {
    points += 10;
    factors.push({ name: "Elevated Fasting Glucose", impact: "positive", description: "Glucose (100-125 mg/dL) shows early glucose intolerance." });
  }

  if (input.hypertension) {
    points += 10;
    factors.push({ name: "Hypertension", impact: "positive", description: "High blood pressure is a known diabetes comorbidity." });
  }

  if (input.heartDisease) {
    points += 10;
    factors.push({ name: "Heart Disease", impact: "positive", description: "Prior cardiac history links with metabolic syndrome." });
  }

  const riskScore = Math.max(1.0, Math.min(99.0, points));
  let riskCategory: "LOW" | "MODERATE" | "HIGH" = "LOW";
  if (riskScore >= 50) {
    riskCategory = "HIGH";
  } else if (riskScore >= 20) {
    riskCategory = "MODERATE";
  }

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
    modelConfidence: 0.95
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed database on startup — development only to prevent fake data in production
  if (process.env.NODE_ENV !== "production") {
    seedDatabase().catch(console.error);
  }

  // Issue a JWT token for the currently authenticated session user
  app.get("/api/auth/token", requireAuth, requireVerified, (req, res) => {
    // Session is guaranteed by requireAuth
    const user = req.session.user;
    if (!user || !user.id || !user.email) {
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
      const tempFile = path.join(
        os.tmpdir(),
        `${randomUUID()}.json`
      );

      try {
        await writeFile(tempFile, JSON.stringify(input));

        let prediction;
        try {
          const { stdout, stderr } = await execFileAsync(
            getPythonExecutable(),
            [analyzePyPath, "predict_file", tempFile],
            {
              timeout: 30000
            }
          );
          prediction = JSON.parse(stdout.trim());
          if (prediction.error) {
            return res.status(400).json({
              message: prediction.error
            });
          }
        } catch (error: any) {
          if (error.killed || error.signal === "SIGTERM") {
            return res.status(408).json({
              message: "Clinical assessment preview timed out."
            });
          }
          console.warn("Python prediction preview failed, running clinical rule-based fallback:", error);
          prediction = calculateClinicalFallback(input);
        }
        console.log(`[AUDIT] preview requested by=${req.session.user?.email} riskCategory=${prediction.riskCategory} riskScore=${prediction.riskScore} at=${new Date().toISOString()}`);
        return res.json({
          riskScore: prediction.riskScore,
          riskCategory: prediction.riskCategory,
          factors: prediction.factors ?? [],
          confidenceInterval: prediction.confidenceInterval ?? null,
          modelConfidence: prediction.modelConfidence ?? null
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message
          });
        }

        console.error("Error creating assessment preview:", err);

        return res.status(500).json({
          message: "Internal server error"
        });
      } finally {
        try {
          await unlink(tempFile);
        } catch (e) {}
      }
    }
  );

  app.post(
    api.assessments.create.path,
    requireAuth,
    requireVerified,
    assessmentLimiter,
    async (req, res) => {
      const userId = req.session.user?.email;
      if (!userId) {
        return res.status(401).json({
          message: "Authentication required.",
        });
      }

      let requestFingerprint: string | null = null;
      let tempFile: string | null = null;

      try {
        const input = api.assessments.create.input.parse(req.body);
        requestFingerprint = generateRequestFingerprint(input, userId);

        if (activeInferenceRequests.has(requestFingerprint)) {
          return res.status(409).json({
            message: "An identical assessment request is already being processed."
          });
        }

        activeInferenceRequests.add(requestFingerprint);

        tempFile = path.join(
          os.tmpdir(),
          `${randomUUID()}.json`
        );

        await writeFile(tempFile, JSON.stringify(input));

        let prediction;
        let isFallback = false;

        try {
          const { stdout, stderr } = await execFileAsync(
            getPythonExecutable(),
            [analyzePyPath, "predict_file", tempFile],
            {
              timeout: 30000
            }
          );
          prediction = JSON.parse(stdout.trim());
          if (prediction.error) {
            return res.status(400).json({
              message: prediction.error
            });
          }
        } catch (error: any) {
          if (error.killed || error.signal === "SIGTERM") {
            return res.status(408).json({
              message: "Clinical assessment generation timed out."
            });
          }
          console.warn("Python ML prediction failed, running clinical rule-based fallback:", error);
          prediction = calculateClinicalFallback(input);
          isFallback = true;
        }

        prediction.disclaimer =
          "DISCLAIMER: This is a clinical decision support tool and is not a medical diagnosis. Please consult with a healthcare professional for clinical decisions.";
        if (isFallback) {
          prediction.disclaimer += " (Generated via fallback rule-based clinical support model due to system unavailability)";
        }

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
        console.log(`[AUDIT] prediction created by=${userId} riskCategory=${prediction.riskCategory} riskScore=${prediction.riskScore} at=${new Date().toISOString()}`);
        return res.status(201).json({
          ...assessment,
          prediction
        });

      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message
          });
        }

        console.error("Error creating assessment:", err);
        return res.status(500).json({
          message: "Failed to generate clinical assessment."
        });
      } finally {
        if (tempFile) {
          try {
            await unlink(tempFile);
          } catch (e) {}
        }
        if (requestFingerprint) {
          activeInferenceRequests.delete(requestFingerprint);
        }
      }
    }
  );

  app.get(api.assessments.list.path, requireAuth, requireVerified, async (req, res) => {
    try {
      const userEmail = req.session.user?.email;
      const assessments = await storage.getAssessments(50, 0, userEmail);

      res.json(assessments);

    } catch (err) {
      res.status(500).json({
        message: "Failed to fetch assessments"
      });
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

        const csv = assessmentsToCsv(
          assessments as unknown as Record<string, unknown>[]
        );

  /**
   * GET /api/assessments/search
   *
   * Secure patient/assessment search endpoint.
   *
   * Security controls:
   * 1. PRIMARY: Drizzle ORM ilike()/eq() — query parameters are bound placeholders,
   *    never interpolated into raw SQL strings.  This prevents SQL injection.
   * 2. SUPPLEMENTARY: Zod schema validates input length, character set, and rejects
   *    known injection signatures before the query is even constructed.
   * 3. Security logging: suspicious patterns are logged (without PHI) for audit.
   * 4. User scoping: results are always filtered to the authenticated user's records.
   * 5. Generic errors: DB errors are sanitized — no table names or SQL syntax leaked.
   *
   * Query params:
   *   q            - search term (max 200 chars, safe characters only)
   *   riskCategory - optional: LOW | MODERATE | HIGH
   *   page         - page number (default 1)
   *   limit        - results per page, max 100 (default 20)
   */
  app.get(
    "/api/assessments/search",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        // 1. Validate and parse query parameters
        const parseResult = searchQuerySchema.safeParse(req.query);

        if (!parseResult.success) {
          // Check whether the failure looks like an injection attempt
          const rawQ = typeof req.query.q === "string" ? req.query.q : "";
          const analysis = analyzeSearchInput(rawQ);

          if (!analysis.safe) {
            logSecurityEvent(
              "SQL_INJECTION_ATTEMPT",
              "Injection-like pattern detected in search query parameter",
              req,
              {
                matchedPattern: analysis.pattern,
                userId: req.session.user?.id,
              }
            );
          } else {
            logSecurityEvent(
              "MALFORMED_SEARCH_QUERY",
              "Search query failed validation",
              req,
              { userId: req.session.user?.id }
            );
          }

          return res.status(400).json({
            message: parseResult.error.errors[0]?.message ?? "Invalid search parameters.",
          });
        }

        const { q, riskCategory, page, limit } = parseResult.data;
        const offset = (page - 1) * limit;
        const userEmail = req.session.user?.email;

        // 2. Log suspicious-but-valid patterns for monitoring
        if (q) {
          const analysis = analyzeSearchInput(q);
          if (!analysis.safe) {
            // Validation already rejected this above, but log defensively
            logSecurityEvent(
              "SUSPICIOUS_SEARCH_PATTERN",
              "Validated search term contains a suspicious pattern",
              req,
              { matchedPattern: analysis.pattern, userId: req.session.user?.id }
            );
          }
        }

        // 3. Execute parameterized search — Drizzle ORM sends $1, $2 … placeholders
        const results = await storage.searchAssessments(
          q ?? "",
          userEmail,
          riskCategory,
          limit,
          offset
        );

        return res.json(results);

      } catch (err) {
        // 4. Sanitize DB errors — never expose table names, SQL syntax, or stack traces
        console.error("Assessment search error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  /**
   * GET /api/assessments/:id
   *
   * Fetch a single assessment by numeric ID.
   * Results are scoped to the authenticated user to prevent cross-user data access.
   *
   * Security: uses Drizzle ORM eq() with bound parameters — not string-concatenated.
   */
  app.get(
    "/api/assessments/:id",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id) || id <= 0) {
          return res.status(400).json({ message: "Invalid assessment ID." });
        }

        const user = req.session.user;
        if (!user) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Fetch the record regardless of owner
        const assessment = await storage.getAssessmentById(id);

        if (!assessment) {
          // Normal 404
          return res.status(404).json({ message: "Assessment not found." });
        }

        // Object-Level Authorization Check
        if (!canAccessPatientRecord(user, assessment)) {
          // Log unauthorized access attempt (IDOR/Enumeration attempt)
          logAccessAttempt(
            user.id,
            "Assessment",
            id,
            false,
            "IDOR attempt: User not authorized to access this patient record"
          );
          
          // Return 404 to prevent ID enumeration
          return res.status(404).json({ message: "Assessment not found." });
        }

  /**
   * GET /api/assessments/search
   *
   * Secure patient/assessment search endpoint.
   *
   * Security controls:
   * 1. PRIMARY: Drizzle ORM ilike()/eq() — query parameters are bound placeholders,
   *    never interpolated into raw SQL strings.  This prevents SQL injection.
   * 2. SUPPLEMENTARY: Zod schema validates input length, character set, and rejects
   *    known injection signatures before the query is even constructed.
   * 3. Security logging: suspicious patterns are logged (without PHI) for audit.
   * 4. User scoping: results are always filtered to the authenticated user's records.
   * 5. Generic errors: DB errors are sanitized — no table names or SQL syntax leaked.
   *
   * Query params:
   *   q            - search term (max 200 chars, safe characters only)
   *   riskCategory - optional: LOW | MODERATE | HIGH
   *   page         - page number (default 1)
   *   limit        - results per page, max 100 (default 20)
   */
  app.get(
    "/api/assessments/search",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        // 1. Validate and parse query parameters
        const parseResult = searchQuerySchema.safeParse(req.query);

        if (!parseResult.success) {
          // Check whether the failure looks like an injection attempt
          const rawQ = typeof req.query.q === "string" ? req.query.q : "";
          const analysis = analyzeSearchInput(rawQ);

          if (!analysis.safe) {
            logSecurityEvent(
              "SQL_INJECTION_ATTEMPT",
              "Injection-like pattern detected in search query parameter",
              req,
              {
                matchedPattern: analysis.pattern,
                userId: req.session.user?.id,
              }
            );
          } else {
            logSecurityEvent(
              "MALFORMED_SEARCH_QUERY",
              "Search query failed validation",
              req,
              { userId: req.session.user?.id }
            );
          }

          return res.status(400).json({
            message: parseResult.error.errors[0]?.message ?? "Invalid search parameters.",
          });
        }

        const { q, riskCategory, page, limit } = parseResult.data;
        const offset = (page - 1) * limit;
        const userEmail = req.session.user?.email;

        // 2. Log suspicious-but-valid patterns for monitoring
        if (q) {
          const analysis = analyzeSearchInput(q);
          if (!analysis.safe) {
            // Validation already rejected this above, but log defensively
            logSecurityEvent(
              "SUSPICIOUS_SEARCH_PATTERN",
              "Validated search term contains a suspicious pattern",
              req,
              { matchedPattern: analysis.pattern, userId: req.session.user?.id }
            );
          }
        }

        // 3. Execute parameterized search — Drizzle ORM sends $1, $2 … placeholders
        const results = await storage.searchAssessments(
          q ?? "",
          userEmail,
          riskCategory,
          limit,
          offset
        );

        return res.json(results);

      } catch (err) {
        // 4. Sanitize DB errors — never expose table names, SQL syntax, or stack traces
        console.error("Assessment search error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  /**
   * GET /api/assessments/:id
   *
   * Fetch a single assessment by numeric ID.
   * Results are scoped to the authenticated user to prevent cross-user data access.
   *
   * Security: uses Drizzle ORM eq() with bound parameters — not string-concatenated.
   */
  app.get(
    "/api/assessments/:id",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id) || id <= 0) {
          return res.status(400).json({ message: "Invalid assessment ID." });
        }

        const userEmail = req.session.user?.email;
        const assessment = await storage.getAssessmentById(id, userEmail);

        if (!assessment) {
          // Return 404 regardless of whether the record exists or belongs to another user
          // to prevent information disclosure via timing/enumeration
          return res.status(404).json({ message: "Assessment not found." });
        }

        return res.json(assessment);

      } catch (err) {
        console.error("Assessment fetch error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  /**
   * GET /api/assessments/search
   *
   * Secure patient/assessment search endpoint.
   *
   * Security controls:
   * 1. PRIMARY: Drizzle ORM ilike()/eq() — query parameters are bound placeholders,
   *    never interpolated into raw SQL strings.  This prevents SQL injection.
   * 2. SUPPLEMENTARY: Zod schema validates input length, character set, and rejects
   *    known injection signatures before the query is even constructed.
   * 3. Security logging: suspicious patterns are logged (without PHI) for audit.
   * 4. User scoping: results are always filtered to the authenticated user's records.
   * 5. Generic errors: DB errors are sanitized — no table names or SQL syntax leaked.
   *
   * Query params:
   *   q            - search term (max 200 chars, safe characters only)
   *   riskCategory - optional: LOW | MODERATE | HIGH
   *   page         - page number (default 1)
   *   limit        - results per page, max 100 (default 20)
   */
  app.get(
    "/api/assessments/search",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        // 1. Validate and parse query parameters
        const parseResult = searchQuerySchema.safeParse(req.query);

        if (!parseResult.success) {
          // Check whether the failure looks like an injection attempt
          const rawQ = typeof req.query.q === "string" ? req.query.q : "";
          const analysis = analyzeSearchInput(rawQ);

          if (!analysis.safe) {
            logSecurityEvent(
              "SQL_INJECTION_ATTEMPT",
              "Injection-like pattern detected in search query parameter",
              req,
              {
                matchedPattern: analysis.pattern,
                userId: req.session.user?.id,
              }
            );
          } else {
            logSecurityEvent(
              "MALFORMED_SEARCH_QUERY",
              "Search query failed validation",
              req,
              { userId: req.session.user?.id }
            );
          }

          return res.status(400).json({
            message: parseResult.error.errors[0]?.message ?? "Invalid search parameters.",
          });
        }

        const { q, riskCategory, page, limit } = parseResult.data;
        const offset = (page - 1) * limit;
        const userEmail = req.session.user?.email;

        // 2. Log suspicious-but-valid patterns for monitoring
        if (q) {
          const analysis = analyzeSearchInput(q);
          if (!analysis.safe) {
            // Validation already rejected this above, but log defensively
            logSecurityEvent(
              "SUSPICIOUS_SEARCH_PATTERN",
              "Validated search term contains a suspicious pattern",
              req,
              { matchedPattern: analysis.pattern, userId: req.session.user?.id }
            );
          }
        }

        // 3. Execute parameterized search — Drizzle ORM sends $1, $2 … placeholders
        const results = await storage.searchAssessments(
          q ?? "",
          userEmail,
          riskCategory,
          limit,
          offset
        );

        return res.json(results);

      } catch (err) {
        // 4. Sanitize DB errors — never expose table names, SQL syntax, or stack traces
        console.error("Assessment search error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  /**
   * GET /api/assessments/:id
   *
   * Fetch a single assessment by numeric ID.
   * Results are scoped to the authenticated user to prevent cross-user data access.
   *
   * Security: uses Drizzle ORM eq() with bound parameters — not string-concatenated.
   */
  app.get(
    "/api/assessments/:id",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id) || id <= 0) {
          return res.status(400).json({ message: "Invalid assessment ID." });
        }

        const userEmail = req.session.user?.email;
        const assessment = await storage.getAssessmentById(id, userEmail);

        if (!assessment) {
          // Return 404 regardless of whether the record exists or belongs to another user
          // to prevent information disclosure via timing/enumeration
          return res.status(404).json({ message: "Assessment not found." });
        }

        return res.json(assessment);

      } catch (err) {
        console.error("Assessment fetch error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  /**
   * GET /api/assessments/search
   *
   * Secure patient/assessment search endpoint.
   *
   * Security controls:
   * 1. PRIMARY: Drizzle ORM ilike()/eq() — query parameters are bound placeholders,
   *    never interpolated into raw SQL strings.  This prevents SQL injection.
   * 2. SUPPLEMENTARY: Zod schema validates input length, character set, and rejects
   *    known injection signatures before the query is even constructed.
   * 3. Security logging: suspicious patterns are logged (without PHI) for audit.
   * 4. User scoping: results are always filtered to the authenticated user's records.
   * 5. Generic errors: DB errors are sanitized — no table names or SQL syntax leaked.
   *
   * Query params:
   *   q            - search term (max 200 chars, safe characters only)
   *   riskCategory - optional: LOW | MODERATE | HIGH
   *   page         - page number (default 1)
   *   limit        - results per page, max 100 (default 20)
   */
  app.get(
    "/api/assessments/search",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        // 1. Validate and parse query parameters
        const parseResult = searchQuerySchema.safeParse(req.query);

        if (!parseResult.success) {
          // Check whether the failure looks like an injection attempt
          const rawQ = typeof req.query.q === "string" ? req.query.q : "";
          const analysis = analyzeSearchInput(rawQ);

          if (!analysis.safe) {
            logSecurityEvent(
              "SQL_INJECTION_ATTEMPT",
              "Injection-like pattern detected in search query parameter",
              req,
              {
                matchedPattern: analysis.pattern,
                userId: req.session.user?.id,
              }
            );
          } else {
            logSecurityEvent(
              "MALFORMED_SEARCH_QUERY",
              "Search query failed validation",
              req,
              { userId: req.session.user?.id }
            );
          }

          return res.status(400).json({
            message: parseResult.error.errors[0]?.message ?? "Invalid search parameters.",
          });
        }

        const { q, riskCategory, page, limit } = parseResult.data;
        const offset = (page - 1) * limit;
        const userEmail = req.session.user?.email;

        // 2. Log suspicious-but-valid patterns for monitoring
        if (q) {
          const analysis = analyzeSearchInput(q);
          if (!analysis.safe) {
            // Validation already rejected this above, but log defensively
            logSecurityEvent(
              "SUSPICIOUS_SEARCH_PATTERN",
              "Validated search term contains a suspicious pattern",
              req,
              { matchedPattern: analysis.pattern, userId: req.session.user?.id }
            );
          }
        }

        // 3. Execute parameterized search — Drizzle ORM sends $1, $2 … placeholders
        const results = await storage.searchAssessments(
          q ?? "",
          userEmail,
          riskCategory,
          limit,
          offset
        );

        return res.json(results);

      } catch (err) {
        // 4. Sanitize DB errors — never expose table names, SQL syntax, or stack traces
        console.error("Assessment search error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  /**
   * GET /api/assessments/:id
   *
   * Fetch a single assessment by numeric ID.
   * Results are scoped to the authenticated user to prevent cross-user data access.
   *
   * Security: uses Drizzle ORM eq() with bound parameters — not string-concatenated.
   */
  app.get(
    "/api/assessments/:id",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id) || id <= 0) {
          return res.status(400).json({ message: "Invalid assessment ID." });
        }

        const user = req.session.user;
        if (!user) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Fetch the record regardless of owner
        const assessment = await storage.getAssessmentById(id);

        if (!assessment) {
          // Normal 404
          return res.status(404).json({ message: "Assessment not found." });
        }

        // Object-Level Authorization Check
        if (!canAccessPatientRecord(user, assessment)) {
          // Log unauthorized access attempt (IDOR/Enumeration attempt)
          logAccessAttempt(
            user.id,
            "Assessment",
            id,
            false,
            "IDOR attempt: User not authorized to access this patient record"
          );
          
          // Return 404 to prevent ID enumeration
          return res.status(404).json({ message: "Assessment not found." });
        }

        // Authorized access
        logAccessAttempt(user.id, "Assessment", id, true, "Authorized access");
        return res.json(assessment);

      } catch (err) {
        console.error("Assessment fetch error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  /**
   * GET /api/assessments/search
   *
   * Secure patient/assessment search endpoint.
   *
   * Security controls:
   * 1. PRIMARY: Drizzle ORM ilike()/eq() — query parameters are bound placeholders,
   *    never interpolated into raw SQL strings.  This prevents SQL injection.
   * 2. SUPPLEMENTARY: Zod schema validates input length, character set, and rejects
   *    known injection signatures before the query is even constructed.
   * 3. Security logging: suspicious patterns are logged (without PHI) for audit.
   * 4. User scoping: results are always filtered to the authenticated user's records.
   * 5. Generic errors: DB errors are sanitized — no table names or SQL syntax leaked.
   *
   * Query params:
   *   q            - search term (max 200 chars, safe characters only)
   *   riskCategory - optional: LOW | MODERATE | HIGH
   *   page         - page number (default 1)
   *   limit        - results per page, max 100 (default 20)
   */
  app.get(
    "/api/assessments/search",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        // 1. Validate and parse query parameters
        const parseResult = searchQuerySchema.safeParse(req.query);

        if (!parseResult.success) {
          // Check whether the failure looks like an injection attempt
          const rawQ = typeof req.query.q === "string" ? req.query.q : "";
          const analysis = analyzeSearchInput(rawQ);

          if (!analysis.safe) {
            logSecurityEvent(
              "SQL_INJECTION_ATTEMPT",
              "Injection-like pattern detected in search query parameter",
              req,
              {
                matchedPattern: analysis.pattern,
                userId: req.session.user?.id,
              }
            );
          } else {
            logSecurityEvent(
              "MALFORMED_SEARCH_QUERY",
              "Search query failed validation",
              req,
              { userId: req.session.user?.id }
            );
          }

          return res.status(400).json({
            message: parseResult.error.errors[0]?.message ?? "Invalid search parameters.",
          });
        }

        const { q, riskCategory, page, limit } = parseResult.data;
        const offset = (page - 1) * limit;
        const userEmail = req.session.user?.email;

        // 2. Log suspicious-but-valid patterns for monitoring
        if (q) {
          const analysis = analyzeSearchInput(q);
          if (!analysis.safe) {
            // Validation already rejected this above, but log defensively
            logSecurityEvent(
              "SUSPICIOUS_SEARCH_PATTERN",
              "Validated search term contains a suspicious pattern",
              req,
              { matchedPattern: analysis.pattern, userId: req.session.user?.id }
            );
          }
        }

        // 3. Execute parameterized search — Drizzle ORM sends $1, $2 … placeholders
        const results = await storage.searchAssessments(
          q ?? "",
          userEmail,
          riskCategory,
          limit,
          offset
        );

        return res.json(results);

      } catch (err) {
        // 4. Sanitize DB errors — never expose table names, SQL syntax, or stack traces
        console.error("Assessment search error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  /**
   * GET /api/assessments/:id
   *
   * Fetch a single assessment by numeric ID.
   * Results are scoped to the authenticated user to prevent cross-user data access.
   *
   * Security: uses Drizzle ORM eq() with bound parameters — not string-concatenated.
   */
  app.get(
    "/api/assessments/:id",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id) || id <= 0) {
          return res.status(400).json({ message: "Invalid assessment ID." });
        }

        const user = req.session.user;
        if (!user) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Fetch the record regardless of owner
        const assessment = await storage.getAssessmentById(id);

        if (!assessment) {
          // Normal 404
          return res.status(404).json({ message: "Assessment not found." });
        }

        // Object-Level Authorization Check
        if (!canAccessPatientRecord(user, assessment)) {
          // Log unauthorized access attempt (IDOR/Enumeration attempt)
          logAccessAttempt(
            user.id,
            "Assessment",
            id,
            false,
            "IDOR attempt: User not authorized to access this patient record"
          );
          
          // Return 404 to prevent ID enumeration
          return res.status(404).json({ message: "Assessment not found." });
        }

        // Authorized access
        logAccessAttempt(user.id, "Assessment", id, true, "Authorized access");
        return res.json(assessment);

      } catch (err) {
        console.error("Assessment fetch error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  /**
   * GET /api/assessments/search
   *
   * Secure patient/assessment search endpoint.
   *
   * Security controls:
   * 1. PRIMARY: Drizzle ORM ilike()/eq() — query parameters are bound placeholders,
   *    never interpolated into raw SQL strings.  This prevents SQL injection.
   * 2. SUPPLEMENTARY: Zod schema validates input length, character set, and rejects
   *    known injection signatures before the query is even constructed.
   * 3. Security logging: suspicious patterns are logged (without PHI) for audit.
   * 4. User scoping: results are always filtered to the authenticated user's records.
   * 5. Generic errors: DB errors are sanitized — no table names or SQL syntax leaked.
   *
   * Query params:
   *   q            - search term (max 200 chars, safe characters only)
   *   riskCategory - optional: LOW | MODERATE | HIGH
   *   page         - page number (default 1)
   *   limit        - results per page, max 100 (default 20)
   */
  app.get(
    "/api/assessments/search",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        // 1. Validate and parse query parameters
        const parseResult = searchQuerySchema.safeParse(req.query);

        if (!parseResult.success) {
          // Check whether the failure looks like an injection attempt
          const rawQ = typeof req.query.q === "string" ? req.query.q : "";
          const analysis = analyzeSearchInput(rawQ);

          if (!analysis.safe) {
            logSecurityEvent(
              "SQL_INJECTION_ATTEMPT",
              "Injection-like pattern detected in search query parameter",
              req,
              {
                matchedPattern: analysis.pattern,
                userId: req.session.user?.id,
              }
            );
          } else {
            logSecurityEvent(
              "MALFORMED_SEARCH_QUERY",
              "Search query failed validation",
              req,
              { userId: req.session.user?.id }
            );
          }

          return res.status(400).json({
            message: parseResult.error.errors[0]?.message ?? "Invalid search parameters.",
          });
        }

        const { q, riskCategory, page, limit } = parseResult.data;
        const offset = (page - 1) * limit;
        const userEmail = req.session.user?.email;

        // 2. Log suspicious-but-valid patterns for monitoring
        if (q) {
          const analysis = analyzeSearchInput(q);
          if (!analysis.safe) {
            // Validation already rejected this above, but log defensively
            logSecurityEvent(
              "SUSPICIOUS_SEARCH_PATTERN",
              "Validated search term contains a suspicious pattern",
              req,
              { matchedPattern: analysis.pattern, userId: req.session.user?.id }
            );
          }
        }

        // 3. Execute parameterized search — Drizzle ORM sends $1, $2 … placeholders
        const results = await storage.searchAssessments(
          q ?? "",
          userEmail,
          riskCategory,
          limit,
          offset
        );

        return res.json(results);

      } catch (err) {
        // 4. Sanitize DB errors — never expose table names, SQL syntax, or stack traces
        console.error("Assessment search error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  /**
   * GET /api/assessments/:id
   *
   * Fetch a single assessment by numeric ID.
   * Results are scoped to the authenticated user to prevent cross-user data access.
   *
   * Security: uses Drizzle ORM eq() with bound parameters — not string-concatenated.
   */
  app.get(
    "/api/assessments/:id",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id, 10);

        if (isNaN(id) || id <= 0) {
          return res.status(400).json({ message: "Invalid assessment ID." });
        }

        const user = req.session.user;
        if (!user) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        // Fetch the record regardless of owner
        const assessment = await storage.getAssessmentById(id);

        if (!assessment) {
          // Normal 404
          return res.status(404).json({ message: "Assessment not found." });
        }

        // Object-Level Authorization Check
        if (!canAccessPatientRecord(user, assessment)) {
          // Log unauthorized access attempt (IDOR/Enumeration attempt)
          logAccessAttempt(
            user.id,
            "Assessment",
            id,
            false,
            "IDOR attempt: User not authorized to access this patient record"
          );
          
          // Return 404 to prevent ID enumeration
          return res.status(404).json({ message: "Assessment not found." });
        }

        // Authorized access
        logAccessAttempt(user.id, "Assessment", id, true, "Authorized access");
        return res.json(assessment);

      } catch (err) {
        console.error("Assessment fetch error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  return httpServer;
}
