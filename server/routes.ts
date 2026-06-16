import mlRouter from "./routes/ml.routes";
import exportsRouter from "./routes/exports.routes";
import analyticsRouter from "./routes/analytics.routes";
import uploadRouter from "./routes/upload.routes";
import authRouter from "./routes/auth.routes";
import type { Express } from "express";
import type { Server } from "http";

import assessmentsRouter from "./routes/assessments.routes";
import fhirRouter from "./routes/fhir.routes";
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
import { getAssessmentQueue, getPythonExecutable } from "./queue";
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

  // Support test compatibility — some tests reference lastStatus globally
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

        logger.info(`[AUDIT] preview requested by=${req.session.user?.email} riskCategory=${prediction.riskCategory} riskScore=${prediction.riskScore} at=${new Date().toISOString()}`);
        return res.json({
          riskScore: prediction.riskScore,
          riskCategory: prediction.riskCategory,
          factors: prediction.factors ?? [],
          confidenceInterval: prediction.confidenceInterval ?? null,
          modelConfidence: prediction.modelConfidence ?? null
        });
      } catch (err: any) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message
          });
        }
        if (err.message?.includes("timed out")) {
          return res.status(503).json({
            message: "Clinical assessment preview timed out."
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

        let prediction: any;
        try {
          const { stdout } = await execFileAsync(
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

  app.get(
    "/api/queue/health",
    requireAuth,
    requireAdmin,
    async (_req, res) => {
      try {
        const metrics = await getQueueMetrics();
        res.json(metrics);
      } catch (err) {
        logger.error({ err }, "Error fetching queue health");
        res.status(500).json({ message: "Failed to fetch queue health" });
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

      res.json(assessments);

    } catch (err) {
      res.status(500).json({
        message: "Failed to fetch assessments"
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

        return res.json(results);

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
        return res.json(result);
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
          assessments.data as unknown as Record<string, unknown>[]
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
        // 4. Sanitize DB errors — never expose table names, SQL syntax, or stack traces
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

  // ─── Admin Routes ────────────────────────────────────────────────

  // Apply admin rate limiter to all admin routes
  app.use("/api/admin", adminLimiter);

  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const result = await storage.getAllUsers(page, limit);
      res.json(result);
    } catch (err) {
      logger.error({ err }, "Admin users fetch error:");
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
      logger.error({ err }, "Admin audit logs fetch error:");
      res.status(500).json({ message: "Failed to fetch audit logs." });
    }
  });

  app.patch("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = req.params.id as string;
      const { isActive, role } = req.body;
      const updated = await storage.updateUser(id, { isActive, role });
      res.json(updated);
    } catch (err) {
      logger.error({ err }, "Admin user update error:");
      res.status(500).json({ message: "Failed to update user." });
    }
  });

  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (err) {
      logger.error({ err }, "Admin stats fetch error:");
      res.status(500).json({ message: "Failed to fetch system stats." });
    }
  });

  // ─── Model Monitoring Routes ──────────────────────────────────────

  app.get("/api/admin/model/versions", requireAuth, requireAdmin, async (req, res) => {
    try {
      const versions = await storage.getModelVersions();
      res.json(versions);
    } catch (err) {
      logger.error({ err }, "Admin model versions fetch error:");
      res.status(500).json({ message: "Failed to fetch model versions." });
    }
  });

  app.get("/api/admin/model/versions/latest", requireAuth, requireAdmin, async (req, res) => {
    try {
      const latest = await storage.getLatestModelVersion();
      res.json(latest ?? null);
    } catch (err) {
      logger.error({ err }, "Admin latest model version fetch error:");
      res.status(500).json({ message: "Failed to fetch latest model version." });
    }
  });

  app.get("/api/admin/model/dataset-stats", requireAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getModelDatasetStats();
      res.json(stats ?? { classBalance: {}, featureStats: {}, totalSamples: 0 });
    } catch (err) {
      logger.error({ err }, "Admin dataset stats fetch error:");
      res.status(500).json({ message: "Failed to fetch dataset stats." });
    }
  });

  app.post("/api/admin/model/retrain", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { stdout, stderr } = await execFileAsync(
        getPythonExecutable(),
        [analyzePyPath, "train_and_evaluate"],
        { timeout: 120000, env: { ...process.env, PYTHONIOENCODING: "utf-8" } }
      );

      if (stderr) {
        logger.warn({ stderr }, "Model retrain stderr:");
      }

      const lines = stdout.trim().split("\n").filter(Boolean);
      const jsonLine = lines.find((l: string) => l.startsWith("{"));
      if (!jsonLine) {
        logger.error({ stdout, stderr }, "Model retrain no JSON output");
        return res.status(500).json({ message: "Retrain produced no valid output." });
      }

      const metrics = JSON.parse(jsonLine);

      if (metrics.error) {
        return res.status(500).json({ message: metrics.error });
      }

      const previousVersion = await storage.getLatestModelVersion();
      const nextVersion = (previousVersion?.version ?? 0) + 1;

      const record = await storage.createModelVersion({
        version: nextVersion,
        accuracy: metrics.accuracy,
        precision: metrics.precision,
        recall: metrics.recall,
        f1Score: metrics.f1_score,
        aucRoc: metrics.auc_roc,
        datasetHash: metrics.dataset_hash,
        numSamples: metrics.num_samples,
        numFeatures: metrics.num_features,
        classBalance: metrics.class_balance,
        featureDistributions: metrics.feature_distributions,
        trainingDurationMs: metrics.training_duration_ms,
        status: "completed",
      });

      logger.info(`Model retrained: version ${nextVersion}, accuracy ${metrics.accuracy}`);
      res.json(record);
    } catch (err: any) {
      logger.error({ err }, "Admin model retrain error:");
      res.status(500).json({ message: err.stderr || "Model retraining failed." });
    }
  });

  app.use("/api/upload", uploadRouter);

  // Endpoint to capture and log client-side React errors
  app.post("/api/logs/client-error", (req, res) => {
    try {
      const { message, stack, componentStack, url, timestamp } = req.body;
      logger.error(
        {
          source: "client",
          url,
          componentStack,
          timestamp,
          stack,
        },
        `[Client Error] ${message}`
      );
      res.status(200).json({ success: true });
    } catch (err) {
      logger.error({ err }, "Failed to parse client error log");
      res.status(500).json({ success: false });
    }
  });

  return httpServer;
}
