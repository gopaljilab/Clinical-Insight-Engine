import mlRouter from "./routes/ml.routes";
import exportsRouter from "./routes/exports.routes";
import analyticsRouter from "./routes/analytics.routes";
import uploadRouter from "./routes/upload.routes";
import type { Express } from "express";
import type { Server } from "http";
import authRouter from "./routes/auth.routes";
import assessmentsRouter from "./routes/assessments.routes";
import { storage, type AssessmentCreateInput } from "./storage";
import { requireAuth, requireAdmin } from "./auth";
import bcrypt from "bcrypt";
import { logger } from "./logger";

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
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
  app.use("/api/assessments", analyticsRouter);
  app.use("/api/assessments", mlRouter);
  app.use("/api/assessments", exportsRouter);
  
  app.use("/api/assessments", assessmentsRouter);

  // ─── Admin Routes ────────────────────────────────────────────────

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
  return httpServer;
}
