import { Router } from "express";
import { getDb } from "../db";
import { alertRules, alerts, insertAlertRuleSchema } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAssessmentAccess"; // Or similar auth middleware
import { logger } from "../logger";

const alertsRouter = Router();

// Middleware to ensure user is logged in
alertsRouter.use((req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
});

// GET /api/alerts/rules - Get all rules for the current clinician
alertsRouter.get("/rules", async (req, res) => {
  try {
    const db = getDb();
    const rules = await db.query.alertRules.findMany({
      where: eq(alertRules.clinicianId, req.user!.id),
      orderBy: (rule, { desc }) => [desc(rule.createdAt)],
    });
    res.json(rules);
  } catch (error) {
    logger.error({ error }, "Error fetching alert rules");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/alerts/rules - Create a new rule
alertsRouter.post("/rules", async (req, res) => {
  try {
    const parseResult = insertAlertRuleSchema.safeParse({
      ...req.body,
      clinicianId: req.user!.id,
    });

    if (!parseResult.success) {
      return res.status(400).json({ message: "Invalid input", errors: parseResult.error.format() });
    }

    const db = getDb();
    const [newRule] = await db.insert(alertRules).values(parseResult.data).returning();
    res.status(201).json(newRule);
  } catch (error) {
    logger.error({ error }, "Error creating alert rule");
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/alerts/rules/:id - Delete a rule
alertsRouter.delete("/rules/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const db = getDb();
    const [deletedRule] = await db.delete(alertRules)
      .where(and(eq(alertRules.id, id), eq(alertRules.clinicianId, req.user!.id)))
      .returning();

    if (!deletedRule) {
      return res.status(404).json({ message: "Rule not found or unauthorized" });
    }

    res.json({ message: "Rule deleted successfully" });
  } catch (error) {
    logger.error({ error }, "Error deleting alert rule");
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/alerts - Get all alerts for the current clinician
alertsRouter.get("/", async (req, res) => {
  try {
    const db = getDb();
    const clinicianAlerts = await db.query.alerts.findMany({
      where: eq(alerts.clinicianId, req.user!.id),
      orderBy: (alert, { desc }) => [desc(alert.createdAt)],
    });
    res.json(clinicianAlerts);
  } catch (error) {
    logger.error({ error }, "Error fetching alerts");
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/alerts/:id/read - Mark an alert as read
alertsRouter.post("/:id/read", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    const db = getDb();
    const [updatedAlert] = await db.update(alerts)
      .set({ isRead: true })
      .where(and(eq(alerts.id, id), eq(alerts.clinicianId, req.user!.id)))
      .returning();

    if (!updatedAlert) {
      return res.status(404).json({ message: "Alert not found or unauthorized" });
    }

    res.json(updatedAlert);
  } catch (error) {
    logger.error({ error }, "Error marking alert as read");
    res.status(500).json({ message: "Internal server error" });
  }
});

export { alertsRouter };
