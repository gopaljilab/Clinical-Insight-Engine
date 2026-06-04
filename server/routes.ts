import type { Express } from "express";
import type { Server } from "http";
import { storage, type AssessmentCreateInput } from "./storage";
import { requireAuth, requireAdmin, requireVerified } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { existsSync } from "fs";
import { writeFile, unlink } from "fs/promises";
import { randomUUID, createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import bcrypt from "bcrypt";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { rateLimit } from "express-rate-limit";
import {
  sanitizeDatabaseError,
  analyzeSearchInput,
  logSecurityEvent,
} from "./security/sqlProtection";
import { searchQuerySchema } from "./validation/searchValidation";
import { canAccessPatientRecord } from "./services/authz/patient-access";
import { logAccessAttempt } from "./security/access-audit";
import { issueToken } from "./services/auth/tokenValidator";

export const execFileAsync = promisify(execFile);

function runPythonInference(
  executable: string,
  args: string[],
  inputData: any,
  timeoutMs: number = 30000
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      executable,
      args,
      { timeout: timeoutMs },
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      }
    );

    if (child.stdin) {
      child.stdin.on("error", (err) => {
        console.error("Stdin write error:", err);
      });
      child.stdin.write(JSON.stringify(inputData));
      child.stdin.end();
    }
  });
}

export class SimpleSemaphore {
  private activeCount = 0;
  private queue: (() => void)[] = [];

  constructor(private maxConcurrency: number) {}

  async acquire(): Promise<void> {
    if (this.activeCount < this.maxConcurrency) {
      this.activeCount++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) next();
    } else {
      this.activeCount--;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

const inferenceConcurrencyLimiter = new SimpleSemaphore(4);

/**
 * Tracks currently running inference requests to prevent
 * duplicate concurrent ML execution for identical payloads.
 */
const activeInferenceRequests = new Set<string>();

const predictionFactorSchema = z.object({
  name: z.string(),
  impact: z.enum(["positive", "negative"]),
  description: z.string(),
});

const pythonPredictionSchema = z.union([
  z.object({
    error: z.string().min(1),
  }),
  z.object({
    riskScore: z.coerce.number().min(0).max(100),
    riskCategory: z.enum(["LOW", "MODERATE", "HIGH"]),
    factors: z.array(predictionFactorSchema).default([]),
    confidenceInterval: z.string().nullable().optional(),
    modelConfidence: z.coerce.number().min(0).max(1).nullable().optional(),
  }),
]);

type PythonPrediction = z.infer<typeof pythonPredictionSchema>;

function parsePythonPrediction(stdout: string): PythonPrediction {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    throw new Error("Python prediction output was not valid JSON.");
  }

  return pythonPredictionSchema.parse(parsed);
}

function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalStringify).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map((k) => JSON.stringify(k) + ":" + canonicalStringify((obj as Record<string, unknown>)[k]));
  return "{" + pairs.join(",") + "}";
}

function generateRequestFingerprint(payload: unknown, userId: string): string {
  const uid = userId || "anonymous";
  return createHash("sha256")
    .update(`${uid}::${canonicalStringify(payload)}`)
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

const previewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many preview requests. Please try again later.",
    retryAfter: 60,
  },
});

const previewLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many assessment preview requests. Please try again later.",
    retryAfter: 60,
  },
});

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

async function seedDatabase() {
  const existingAdmin = await storage.getUserByEmail("admin@clinical-insight-engine.dev");
  if (!existingAdmin) {
    const adminPasswordHash = bcrypt.hashSync("admin123", 10);
    await storage.createUser({
      fullName: "System Admin",
      email: "admin@clinical-insight-engine.dev",
      medicalLicenseNumber: "ADMIN-000001",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isActive: true,
      emailVerified: true,
    });
    console.log("Seeded admin user: admin@clinical-insight-engine.dev / admin123");
  }

  const existing = await storage.getAssessments();
  if (existing.data.length !== 0) return;

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
        {
          name: "Hba1c Level",
          impact: "negative",
          description: "Lowers risk",
        },
      ],
      confidenceInterval: "8.5% - 16.1%",
      modelConfidence: 0.877,
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
        {
          name: "Hba1c Level",
          impact: "positive",
          description: "Increases risk",
        },
        { name: "Bmi", impact: "positive", description: "Increases risk" },
        {
          name: "Hypertension",
          impact: "positive",
          description: "Increases risk",
        },
      ],
      confidenceInterval: "38.9% - 58.5%",
      modelConfidence: 0.513,
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
  factors: Array<{
    name: string;
    impact: "positive" | "negative";
    description: string;
  }>;
  clinicianAdvice: string[];
  patientAdvice: string[];
}

function calculateClinicalFallback(input: unknown): PredictionResult {
  const anyInput = input as any;
  let points = 0;

  // Use anyInput for property access to satisfy TypeScript.

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
      description:
        "Elderly demographic is associated with higher metabolic risk.",
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
        ? [
          "High risk. Refer for diagnostic oral glucose tolerance testing (OGTT).",
        ]
        : riskCategory === "MODERATE"
          ? [
            "Moderate risk. Suggest nutritional counseling and review in 6 months.",
          ]
          : ["Low risk. Encourage standard yearly wellness checks."],
    patientAdvice:
      riskCategory === "HIGH"
        ? [
          "Please schedule an appointment with your clinician to check diagnostic lab ranges.",
        ]
        : riskCategory === "MODERATE"
          ? [
            "Making positive dietary changes and staying active helps lower type 2 diabetes risk.",
          ]
          : [
            "Continue maintaining a healthy, balanced lifestyle and regular physical activity.",
          ],
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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

    const token = issueToken((user as any).id, user.email, "provider");
    res.json({ token });
  });

  app.post(
    api.assessments.preview.path,
    requireAuth,
    requireVerified,
    previewLimiter,
    async (req, res) => {
      const input = api.assessments.preview.input.parse(req.body);
      const tempFilePath = path.join(os.tmpdir(), `${randomUUID()}.json`);

      try {
        await writeFile(tempFilePath, JSON.stringify(input));

        let prediction: any;
        try {
          const { stdout } = await execFileAsync(
            getPythonExecutable(),
            [analyzePyPath, "predict_file", tempFilePath],
            {
              timeout: 30000,
              // 10MB buffer to safely handle verbose Python stdout
              // (scikit-learn/numpy deprecation warnings, model loading logs)
              // without crashing with ERR_CHILD_PROCESS_STDIO_MAXBUFFER.
              maxBuffer: 10 * 1024 * 1024,
            }
          );

          prediction = JSON.parse(stdout.trim());
          if (prediction?.error) {
            return res.status(400).json({ message: prediction.error });
          }
        } catch (error: any) {
          if (error?.killed || error?.signal === "SIGTERM") {
            return res
              .status(408)
              .json({ message: "Clinical assessment preview timed out." });
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
          return res
            .status(400)
            .json({ message: err.errors[0]?.message ?? "Invalid input" });
        }
        console.error("Error creating assessment preview:", err);
        return res.status(500).json({ message: "Internal server error" });
      } finally {
        try {
          await unlink(tempFilePath);
        } catch (e) {
          console.warn("Failed to clean up temp file (preview):", tempFilePath, e);
        }
      }
    }
  );

  app.post(
    api.assessments.create.path,
    requireAuth,
    requireVerified,
    assessmentLimiter,
    async (req, res) => {
      const userId = (req.session.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required." });
      }

      let requestFingerprint: string | null = null;
      let tempFilePath: string | null = null; // ✨ 1. Declare it here outside the block scope

      try {
        const input = api.assessments.create.input.parse(req.body);
        requestFingerprint = generateRequestFingerprint(input, userId);

        if (activeInferenceRequests.has(requestFingerprint)) {
          return res.status(409).json({
            message: "An identical assessment request is already being processed.",
          });
        }
        activeInferenceRequests.add(requestFingerprint);

        // ✨ 2. Assign the value inside the block without using 'let' again
        tempFilePath = path.join(os.tmpdir(), `${randomUUID()}.json`);
        await writeFile(tempFilePath, JSON.stringify(input));

        let prediction: any;
        let isFallback = false;

        try {
          const { stdout } = await execFileAsync(
            getPythonExecutable(),
            [analyzePyPath, "predict_file", tempFilePath],
            {
              timeout: 30000,
              maxBuffer: 10 * 1024 * 1024,
            }
          );

          prediction = JSON.parse(stdout.trim());
          if (prediction?.error) {
            return res.status(400).json({ message: prediction.error });
          }
        } catch (error: any) {
          if (error?.killed || error?.signal === "SIGTERM") {
            return res
              .status(408)
              .json({ message: "Clinical assessment generation timed out." });
          }
          prediction = calculateClinicalFallback(input);
          isFallback = true;
        }

        prediction.disclaimer =
          "DISCLAIMER: This is a clinical decision support tool and is not a medical diagnosis. Please consult with a healthcare professional for clinical decisions." +
          (isFallback
            ? " (Generated via fallback rule-based clinical support model due to system unavailability)"
            : "");
        prediction.isFallback = isFallback;

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
          createdBy: userId,
        });

        return res.status(201).json({ ...assessment, prediction });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: err.errors[0]?.message ?? "Invalid input" });
        }
        console.error("Error creating assessment:", err);
        return res
          .status(500)
          .json({ message: "Failed to generate clinical assessment." });
      } finally {
        // ✨ 3. This condition will now successfully evaluate without crashing
        if (tempFilePath) {
          try {
            await unlink(tempFilePath);
          } catch (e) {
            console.warn("Failed to clean up temp file (create):", tempFilePath, e);
          }
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
      logAccessAttempt(req.session.user!.id, "Assessments", "all", true, "Fetched assessment list");

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
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(
          100,
          Math.max(1, parseInt(req.query.limit as string) || 20)
        );
        logAccessAttempt(req.session.user!.id, "Assessments", "all", true, "Exported assessments to CSV");
        res.header("Content-Type", "text/csv");
        res.attachment("assessments.csv");
        return res.send(csv);
      } catch (err) {
        console.error("Export error:", err);
        return res.status(500).json({ message: "Export failed" });
        const offset = (page - 1) * limit;
        const result = await storage.getAssessments(limit, offset, userEmail);
        res.json(result);
      } catch (err) {
        return res.status(500).json({ message: "Failed to fetch assessments" });
      }
    }
  );

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          "attachment; filename=assessments.csv"
        );
        return res.send(csv);
      } catch (err) {
        console.error("CSV export error:", err);
        return res.status(500).json({ message: "Failed to export CSV." });
      }
    }
  );

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=assessments.csv");
        return res.send(csv);
      } catch (err) {
        console.error("Assessment CSV export error:", err);
        return res.status(500).json({
          message: "Failed to export assessments"
        });
      }
    }
  );

  /**
   * GET /api/assessments/search
   *
   * Secure patient/assessment search endpoint.
   *
   * Security controls:
   * 1. PRIMARY: Drizzle ORM ilike()/eq() - query parameters are bound placeholders,
   *    never interpolated into raw SQL strings. This prevents SQL injection.
   * 2. SUPPLEMENTARY: Zod schema validates input length, character set, and rejects
   *    known injection signatures before the query is even constructed.
   * 3. Security logging: suspicious patterns are logged without PHI for audit.
   * 4. User scoping: results are always filtered to the authenticated user's records.
   * 5. Generic errors: DB errors are sanitized.
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
        const parseResult = searchQuerySchema.safeParse(req.query);

        if (!parseResult.success) {
          const rawQ = typeof req.query.q === "string" ? req.query.q : "";
          const analysis = analyzeSearchInput(rawQ);

          if (!analysis.safe) {
            logSecurityEvent(
              "SQL_INJECTION_ATTEMPT",
              "Injection-like pattern detected in search query parameter",
              req,
              {
                matchedPattern: analysis.pattern,
                userId: (req.session.user as any)?.id,
              }
            );
          } else {
            logSecurityEvent(
              "MALFORMED_SEARCH_QUERY",
              "Search query failed validation",
              req,
              { userId: (req.session.user as any)?.id }
            );
          }

          return res.status(400).json({
            message:
              parseResult.error.errors[0]?.message ??
              "Invalid search parameters.",
          });
        }

        const { q, riskCategory, page, limit } = parseResult.data;
        const offset = (page - 1) * limit;
        const userEmail = req.session.user?.email;

        if (q) {
          const analysis = analyzeSearchInput(q);
          if (!analysis.safe) {
            logSecurityEvent(
              "SUSPICIOUS_SEARCH_PATTERN",
              "Validated search term contains a suspicious pattern",
              req,
              {
                matchedPattern: analysis.pattern,
                userId: (req.session.user as any)?.id,
              }
            );
          }
        }

        const results = await storage.searchAssessments(
          q ?? "",
          userEmail,
          riskCategory,
          limit,
          offset
        );
        logAccessAttempt(req.session.user!.id, "Assessments", "search", true, "Searched assessments");
        return res.json(results);

      } catch (err) {
        console.error("Assessment search error:", err);
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  app.get(
    "/api/assessments/analytics",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const userEmail = req.session.user?.email;
        if (!userEmail) {
           return res.status(401).json({ message: "Unauthorized" });
        }
        const stats = await storage.getAnalyticsStats(userEmail);
        return res.json(stats);
      } catch (err) {
        console.error("Analytics fetch error:", err);
        return res.status(500).json({ message: "Failed to fetch analytics" });
      }
    }
  );

  /**
   * GET /api/assessments/:id
   *
   * Fetch a single assessment by numeric ID.
   * Object-level authorization is enforced explicitly before returning records.
   */
  app.get(
    "/api/assessments/:id",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const id = parseInt(req.params.id as string, 10);

        if (isNaN(id) || id <= 0) {
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

        // Object-Level Authorization Check
        if (
          !canAccessPatientRecord(
            user as any,
            assessment
          )
        ) {
          // Log unauthorized access attempt (IDOR/Enumeration attempt)
          logAccessAttempt(
            (user as any).id,
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
        logAccessAttempt(req.session.user!.id, "Assessments", "search", true, "Searched assessments");

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

        const assessment = await storage.getAssessmentById(id);

        if (!assessment) {
          return res.status(404).json({ message: "Assessment not found." });
        }

        if (!canAccessPatientRecord(user, assessment)) {
          logAccessAttempt(user.id, "Assessment", id, false, "IDOR attempt: User not authorized to access this patient record");

          // Return 404 to prevent ID enumeration
          return res.status(404).json({ message: "Assessment not found." });
        }

        // Authorized access
        logAccessAttempt((user as any).id, "Assessment", id, true, "Authorized access");
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
        logAccessAttempt(req.session.user!.id, "Assessments", "search", true, "Searched assessments");

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

        const assessment = await storage.getAssessmentById(id);

        if (!assessment) {
          return res.status(404).json({ message: "Assessment not found." });
        }

        if (!canAccessPatientRecord(user, assessment)) {
          logAccessAttempt(user.id, "Assessment", id, false, "IDOR attempt: User not authorized to access this patient record");
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
        logAccessAttempt(req.session.user!.id, "Assessments", "search", true, "Searched assessments");

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
        logAccessAttempt(req.session.user!.id, "Assessments", "search", true, "Searched assessments");

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
        logAccessAttempt(req.session.user!.id, "Assessments", "search", true, "Searched assessments");

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

  // ─── Admin Routes ────────────────────────────────────────────────

  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await storage.getAllUsers(page, limit);
      res.json(result);
    } catch (err) {
      console.error("Admin users fetch error:", err);
      res.status(500).json({ message: "Failed to fetch users." });
    }
  });

  app.get("/api/admin/audit-logs", requireAuth, requireAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await storage.getLoginAuditLogs(page, limit);
      res.json(result);
    } catch (err) {
      console.error("Admin audit logs fetch error:", err);
      res.status(500).json({ message: "Failed to fetch audit logs." });
    }
  });

  app.patch("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive, role } = req.body;
      const updated = await storage.updateUser(id, { isActive, role });
      res.json(updated);
    } catch (err) {
      console.error("Admin user update error:", err);
      res.status(500).json({ message: "Failed to update user." });
    }
  });

  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (err) {
      console.error("Admin stats fetch error:", err);
      res.status(500).json({ message: "Failed to fetch system stats." });
    }
  });

  return httpServer;
}
