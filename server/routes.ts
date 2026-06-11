import mlRouter from "./routes/ml.routes";
import exportsRouter from "./routes/exports.routes";
import analyticsRouter from "./routes/analytics.routes";
import uploadRouter from "./routes/upload.routes";
import authRouter from "./routes/auth.routes";
import type { Express } from "express";
import type { Server } from "http";

import assessmentsRouter from "./routes/assessments.routes";
import { MLService, generateRequestFingerprint, calculateClinicalFallback, getPythonExecutable } from "./services/mlService";
import { storage, type AssessmentCreateInput } from "./storage";
import { requireAuth, requireAdmin, requireVerified } from "./auth";
import { logger } from "./logger";
import {
  generalLimiter,
  adminLimiter,
} from "./middleware/rateLimit";
import { rateLimit } from "express-rate-limit";
import { getAssessmentQueue } from "./queue";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import { validateDTO } from "./middleware/validateDTO";
import { z } from "zod";
import { api } from "@shared/routes";
import { assessmentsToCsv } from "./utils/csvExport";
import { searchQuerySchema } from "./validation/searchValidation";
import {
  sanitizeDatabaseError,
  analyzeSearchInput,
  logSecurityEvent,
} from "./security/sqlProtection";
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

  // Seed database on startup — development only to prevent fake data in production
  if (process.env.NODE_ENV !== "production") {
    seedDatabase().catch((err) => logger.error({ err }, "Database seeding failed"));
  }

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Mount domain-specific routers
  app.use("/api/auth", authRouter);
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
