import mlRouter from "./routes/ml.routes";
import exportsRouter from "./routes/exports.routes";
import analyticsRouter from "./routes/analytics.routes";
import uploadRouter from "./routes/upload.routes";
import type { Express } from "express";
import type { Server } from "http";
import authRouter from "./routes/auth.routes";
import assessmentsRouter from "./routes/assessments.routes";
import { storage, type AssessmentCreateInput } from "./storage";
import { requireAuth, requireAdmin, requireVerified } from "./auth";
import { api } from "@shared/routes";
import bcrypt from "bcrypt";
import { logger } from "./logger";
import { assessmentsToCsv } from "./utils/csvExport";
import { searchQuerySchema } from "./validation/searchValidation";
import {
  sanitizeDatabaseError,
  analyzeSearchInput,
  logSecurityEvent,
} from "./security/sqlProtection";
import { canAccessPatientRecord } from "./services/authz/patient-access";
import { logAccessAttempt } from "./security/access-audit";


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

  const existingAdmin = await storage.getUserByEmail(email);
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
  if (existing.data.length !== 0) return;

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

  logger.info("Seeding complete!");
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
      : ["Continue maintaining a healthy, balanced lifestyle and regular physical activity."]
  };
}

import { rateLimit } from "express-rate-limit";
import {
  generalLimiter,
  adminLimiter,
} from "./middleware/rateLimit";
import { validateDTO } from "./middleware/validateDTO";
import { z } from "zod";
import { MLService, generateRequestFingerprint } from "./services/mlService";
import { getAssessmentQueue, getPythonExecutable } from "./queue";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import { randomUUID } from "crypto";
import { writeFile, unlink } from "fs/promises";

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
  app.use("/api/assessments", assessmentsRouter);
  app.use("/api/assessments", mlRouter);
  app.use("/api/assessments", exportsRouter);
  app.use("/api/assessments", analyticsRouter);

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
