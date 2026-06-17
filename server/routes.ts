import mlRouter from "./routes/ml.routes";
import exportsRouter from "./routes/exports.routes";
import analyticsRouter from "./routes/analytics.routes";
import uploadRouter from "./routes/upload.routes";
import authRouter from "./routes/auth.routes";
import fhirRouter from "./routes/fhir.routes";
import type { Express } from "express";
import type { Server } from "http";

import assessmentsRouter from "./routes/assessments.routes";
import { storage, type AssessmentCreateInput } from "./storage";
import { requireAuth, requireAdmin, requireVerified } from "./auth";
import { logger } from "./logger";
import {
  generalLimiter,
  adminLimiter,
  exportLimiter,
} from "./middleware/rateLimit";
import { rateLimit } from "express-rate-limit";
import { MLService, calculateClinicalFallback, generateRequestFingerprint, type PredictionResult } from "./services/mlService";
import { getAssessmentQueue, getPythonExecutable, getQueueMetrics } from "./queue";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { api } from "@shared/routes";
import { z } from "zod";
import os from "os";
import { randomUUID } from "crypto";
import { writeFile, unlink } from "fs/promises";
import { validateDTO } from "./middleware/validateDTO";
import { assessmentsToCsv } from "./utils/csvExport";
import { searchQuerySchema, assessmentExportQuerySchema } from "./validation/searchValidation";
import { analyzeSearchInput, logSecurityEvent, sanitizeDatabaseError } from "./security/sqlProtection";
import { canAccessPatientRecord } from "./services/authz/patient-access";
import { logAccessAttempt } from "./security/access-audit";
import { redactForApi } from "./utils/phiRedaction";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "analyze.py");

function execFileAsync(file: string, args: string[], options: any): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout: stdout as unknown as string, stderr: stderr as unknown as string });
    });
  });
}

async function seedDatabase() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (process.env.NODE_ENV === "production") {
    if (!adminEmail) {
      throw new Error("ADMIN_EMAIL environment variable is required in production.");
    }
    if (!adminPassword) {
      throw new Error("ADMIN_PASSWORD environment variable is required in production.");
    }
  }

  const email = adminEmail || "admin@clinical-insight-engine.dev";
  const password = adminPassword || "admin123";

  if (!adminEmail || !adminPassword) {
    logger.warn("[DEV] Using default admin credentials. Set ADMIN_EMAIL and ADMIN_PASSWORD env vars for production.");
  }

  const existingAdmin = await storage.getUserByEmail("admin@clinical-insight-engine.dev");
  if (!existingAdmin) {
    const adminPasswordHash = bcrypt.hashSync(password, 10);
    await storage.createUser({
      fullName: "System Admin",
      email,
      medicalLicenseNumber: "ADMIN-000001",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isActive: true,
      emailVerified: true,
    });
    logger.info("Admin user seeded successfully.");
  }

  const existing = await storage.getAssessments();
  if (existing.data && existing.data.length !== 0) return;

  logger.info("Seeding database with sample assessments...");

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
        { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
        { name: "Bmi", impact: "positive", description: "Increases risk" },
        { name: "Hypertension", impact: "positive", description: "Increases risk" },
      ],
      confidenceInterval: "38.9% - 58.5%",
      modelConfidence: 0.513,
    },
  ];

  for (const sample of samples) {
    await storage.createAssessment(sample);
  }

  logger.info("Seeding complete!");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const previewLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many preview requests. Please try again later.", retryAfter: 60 },
  });

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

  app.use((req, res, next) => {
    res.on("finish", () => {
      (globalThis as any).lastStatus = res.statusCode;
    });
    next();
  });

  // Seed database on startup — development only to prevent fake data in production
  // Minimal unblock: disable seeding by default to avoid schema mismatch errors.
  if (process.env.NODE_ENV !== "production" && process.env.SEED_DB === "true") {
    seedDatabase().catch((err) => logger.error({ err }, "Database seeding failed"));
  }

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Mount auth router
  app.use("/api/auth", authRouter);
  app.use("/api/ingest", fhirRouter);

  app.post(
    api.assessments.preview.path,
    requireAuth,
    requireVerified,
    previewLimiter,
    validateDTO(api.assessments.preview.input),
    async (req, res) => {
      try {
        const input = api.assessments.preview.input.parse(req.body);
        const { prediction } = await MLService.runAssessmentInference(input);

        logger.info(
          `[AUDIT] preview requested by=${req.session.user?.email} riskCategory=${prediction.riskCategory} riskScore=${prediction.riskScore} at=${new Date().toISOString()}`
        );
        return res.json({
          riskScore: prediction.riskScore,
          riskCategory: prediction.riskCategory,
          factors: prediction.factors ?? [],
          confidenceInterval: prediction.confidenceInterval ?? null,
          modelConfidence: prediction.modelConfidence ?? null,
        });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message,
          });
        }
        if (err.message?.includes("timed out")) {
          return res.status(503).json({
            message: "Clinical assessment preview timed out.",
          });
        }
        logger.error({ err }, "Error creating assessment preview");
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  app.post(
    api.assessments.simulate.path,
    requireAuth,
    requireVerified,
    previewLimiter,
    validateDTO(api.assessments.simulate.input),
    async (req, res) => {
      const input = api.assessments.simulate.input.parse(req.body);
      const tempFile = path.join(os.tmpdir(), `${randomUUID()}.json`);

      try {
        await writeFile(tempFile, JSON.stringify(input));

        let prediction;
        try {
          const { stdout, stderr } = await execFileAsync(
            getPythonExecutable(),
            [analyzePyPath, "predict_file", tempFile],
            { timeout: 30000 }
          );
          prediction = JSON.parse(stdout.trim());
          if (prediction.error) {
            return res.status(400).json({ message: prediction.error });
          }
        } catch (error: any) {
          if (error.killed || error.signal === "SIGTERM") {
            return res.status(408).json({ message: "Clinical assessment simulation timed out." });
          }

          logger.warn(
            "Python prediction simulation failed, falling back to clinical rule-based model:",
            error
          );
          prediction = calculateClinicalFallback(input);
        }

        logger.info(
          `[AUDIT] simulate requested by=${req.session.user?.email} riskCategory=${prediction.riskCategory} riskScore=${prediction.riskScore} at=${new Date().toISOString()}`
        );

        return res.json({
          simulatedRisk: prediction.riskScore,
          riskCategory: prediction.riskCategory,
          confidence: prediction.modelConfidence ?? null,
          factorContributions: prediction.factors ?? [],
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: err.errors[0].message });
        }
        logger.error({ err }, "Error creating assessment simulation");
        return res.status(500).json({ message: "Internal server error" });
      } finally {
        try {
          await unlink(tempFile);
        } catch (e) {
          logger.warn({ e, tempFile }, "Failed to clean up temp file (simulate):");
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
      const userId = req.session.user?.email;
      if (!userId) {
        return res.status(401).json({
          message: "Authentication required.",
        });
      }

      let requestFingerprint: string | undefined;
      let didAdd = false;
      try {
        const input = api.assessments.create.input.parse(req.body);
        requestFingerprint = generateRequestFingerprint(input, userId);

        if (MLService.activeInferenceRequests.has(requestFingerprint)) {
          return res.status(409).json({ message: "Assessment request is already being processed." });
        }
        MLService.activeInferenceRequests.add(requestFingerprint);
        didAdd = true;

        const queue = getAssessmentQueue();
        if (!queue) {
          return res.status(503).json({
            message: "Assessment queue is temporarily unavailable.",
          });
        }
        const job = await queue.add("predict", {
          input,
          userId,
          requestFingerprint,
        });

        return res.status(202).json({
          message: "Assessment request accepted and is being processed.",
          jobId: job.id,
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message,
          });
        }
        logger.error({ err }, "Error queueing assessment");
        return res
          .status(500)
          .json({ message: "Failed to queue clinical assessment." });
      } finally {
        if (didAdd) {
          MLService.activeInferenceRequests.delete(requestFingerprint!);
        }
      }
    }
  );

  app.get(
    "/api/assessments/jobs/:id",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const queue = getAssessmentQueue();
        if (!queue) {
          return res.status(503).json({ message: "Assessment queue is temporarily unavailable." });
        }
        const job = await queue.getJob(jobId as string);
        if (!job) {
          return res.status(404).json({ message: "Job not found" });
        }
        const state = await job.getState();
        if (state === "completed") {
          return res.json({ status: "completed", result: job.returnvalue });
        } else if (state === "failed") {
          return res.status(500).json({ status: "failed", error: job.failedReason });
        } else {
          return res.json({ status: state });
        }
      } catch (err) {
        return res.status(500).json({ message: "Error fetching job status" });
      }
    }
  );

  app.post(
    "/api/assessments/bulk",
    requireAuth,
    requireVerified,
    async (req, res) => {
      const userId = (req.session.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required." });
      }

      const inputSchema = z.array(api.assessments.create.input);
      let tempFilePath: string | null = null;
      let requestFingerprint: string | null = null;

      try {
        const input = inputSchema.parse(req.body.assessments);

        requestFingerprint = generateRequestFingerprint(input, userId);
        if (MLService.activeInferenceRequests.has(requestFingerprint)) {
          return res.status(409).json({ message: "Bulk request already processing." });
        }
        MLService.activeInferenceRequests.add(requestFingerprint);

        tempFilePath = path.join(os.tmpdir(), `bulk_${randomUUID()}.json`);
        await writeFile(tempFilePath, JSON.stringify(input));

        let predictions: any[];
        try {
          const { stdout } = await execFileAsync(
            getPythonExecutable(),
            [analyzePyPath, "predict_file", tempFilePath],
            { timeout: 60000, maxBuffer: 50 * 1024 * 1024 }
          );

          predictions = JSON.parse(stdout.trim());
          if (!Array.isArray(predictions)) {
            throw new Error("Expected array of predictions");
          }
        } catch (error: any) {
          predictions = calculateClinicalFallback(input) as PredictionResult[];
        }

        const createdAssessments = await Promise.all(
          input.map((assessment, index) => {
            const prediction = predictions[index];
            return storage.createAssessment({
              ...assessment,
              riskScore: Number(prediction.riskScore),
              riskCategory: prediction.riskCategory,
              factors: prediction.factors,
              confidenceInterval: prediction.confidenceInterval ?? null,
              modelConfidence: prediction.modelConfidence == null ? undefined : Number(prediction.modelConfidence),
              createdBy: userId,
            });
          })
        );

        return res.status(201).json({ count: createdAssessments.length, assessments: createdAssessments });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid bulk input data format. Ensure all rows meet schema requirements." });
        }
        logger.error({ err }, "Bulk create error:");
        return res.status(500).json({ message: "Failed to generate bulk assessments." });
      } finally {
        if (tempFilePath) {
          try { await unlink(tempFilePath); } catch {}
        }
        if (requestFingerprint) {
          MLService.activeInferenceRequests.delete(requestFingerprint);
        }
      }
    }
  );

  app.get(api.assessments.list.path, requireAuth, requireVerified, async (req, res) => {
    try {
      const userEmail = req.session.user?.email;
      const cursorStr = req.query.cursor as string;
      const limitStr = req.query.limit as string;
      const cursor = cursorStr ? parseInt(cursorStr, 10) : undefined;
      const limit = limitStr ? parseInt(limitStr, 10) : 50;

      const assessments = await storage.getAssessments(limit, cursor, userEmail);
      const redactedAssessments = {
        ...assessments,
        data: assessments.data.map((assessment) => redactForApi(assessment)),
      };

      res.json(redactedAssessments);
    } catch (err) {
      res.status(500).json({
        message: "Failed to fetch assessments",
      });
    }
  });

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

        const { q, riskCategory, cursor, limit } = parseResult.data;
        const userEmail = req.session.user?.email;

        if (q) {
          const analysis = analyzeSearchInput(q);
          if (!analysis.safe) {
            logSecurityEvent(
              "SUSPICIOUS_SEARCH_PATTERN",
              "Validated search term contains a suspicious pattern",
              req,
              { matchedPattern: analysis.pattern, userId: req.session.user?.id }
            );
          }
        }

        const results = await storage.searchAssessments(
          q ?? "",
          userEmail,
          riskCategory,
          limit,
          cursor
        );

        return res.json({
          ...results,
          data: results.data.map((assessment) => redactForApi(assessment)),
        });
      } catch (err) {
        logger.error({ err }, "Assessment search error:");
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );

  /**
   * GET /api/assessments/patient/:patientName/trends
   *
   * Returns all historical assessments for a given patient, ordered by date.
   * Used by the Progress Tracking dashboard to plot biomarker trends.
   */
  app.get(
    "/api/assessments/patient/:patientName/trends",
    requireAuth,
    requireVerified,
    async (req, res) => {
      try {
        const patientName = Array.isArray(req.params.patientName) ? req.params.patientName[0] : req.params.patientName;
        const userEmail = req.session.user?.email;
        const result = await storage.getAssessmentsByPatientName(patientName, 100, 0);
        return res.json({
          ...result,
          data: result.data.map((assessment) => redactForApi(assessment)),
        });
      } catch (err) {
        logger.error({ err }, "Patient trends fetch error:");
        return res.status(500).json({ message: "Failed to fetch patient trends." });
      }
    }
  );

  /**
   * GET /api/assessments/export.csv
   *
   * Exports filtered assessments as a CSV file.
   */
  app.get(
    "/api/assessments/export.csv",
    requireAuth,
    requireVerified,
    exportLimiter,
    async (req, res) => {
      try {
        const userEmail = req.session.user?.email;
        const parseResult = assessmentExportQuerySchema.safeParse(req.query);
        if (!parseResult.success) {
          return res.status(400).json({
            message: parseResult.error.errors[0]?.message ?? "Invalid export query parameters.",
          });
        }

        const assessments = await storage.getAssessments({
          ...parseResult.data,
          createdBy: userEmail,
        });

        const csv = assessmentsToCsv(
          assessments.data
            .map((assessment) => redactForApi(assessment)) as Array<Record<string, unknown>>
        );

        res.header("Content-Type", "text/csv");
        res.attachment("assessments.csv");
        return res.send(csv);
      } catch (err) {
        logger.error({ err }, "Export error:");
        return res.status(500).json({ message: "Failed to export data" });
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
        const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const id = parseInt(paramId as string, 10);

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
        if (!canAccessPatientRecord(user as any, assessment)) {
          logAccessAttempt(user.id, "Assessment", id, false, "IDOR attempt: User not authorized to access this patient record");
          return res.status(404).json({ message: "Assessment not found." });
        }

        logAccessAttempt(user.id, "Assessment", id, true, "Authorized access");
        return res.json(redactForApi(assessment));
      } catch (err) {
        logger.error({ err }, "Assessment search error");
        const { statusCode, message } = sanitizeDatabaseError(err);
        return res.status(statusCode).json({ message });
      }
    }
  );
  
  // Mount domain-specific routers (after app-level handlers for precedence)
app.use("/api/assessments", mlRouter);
app.use("/api/assessments", exportsRouter);
app.use("/api/assessments", analyticsRouter);
app.use("/api/assessments", generalLimiter, assessmentsRouter);

app.use("/api/upload", uploadRouter);

return httpServer;
}
