import { Router } from "express";
import { db } from "../db";
import { quarantinedAssessments, insertAssessmentSchema, assessments } from "@shared/schema";
import { eq } from "drizzle-orm";

export const quarantineRoutes = Router();

// GET all quarantined items
quarantineRoutes.get("/", async (req, res) => {
  try {
    const records = await db.query.quarantinedAssessments.findMany({
      orderBy: (qa, { desc }) => [desc(qa.createdAt)],
    });
    return res.json(records);
  } catch (err) {
    console.error("Error fetching quarantined assessments:", err);
    return res.status(500).json({ message: "Failed to fetch quarantined assessments" });
  }
});

// DELETE a quarantined item (Discard)
quarantineRoutes.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    await db.delete(quarantinedAssessments).where(eq(quarantinedAssessments.id, id));
    return res.json({ message: "Deleted successfully" });
  } catch (err) {
    console.error("Error deleting quarantined assessment:", err);
    return res.status(500).json({ message: "Failed to delete" });
  }
});

// POST to resolve and import a quarantined item
quarantineRoutes.post("/:id/resolve", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });

    // Validate the incoming fixed data using the normal assessment schema
    const parseResult = insertAssessmentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        message: "Data is still invalid",
        errors: parseResult.error.errors,
      });
    }

    const validData = parseResult.data;

    // Run inference and insert to assessments just like a normal import
    const { MLService } = await import("../services/mlService");
    const { prediction } = await MLService.runAssessmentInference(validData, req.body.patientName || "unknown", { throwOnFailure: true });

    // Assuming we insert the resolved assessment here:
    const [inserted] = await db.insert(assessments).values({
      ...validData,
      riskScore: prediction.riskScore,
      riskCategory: prediction.riskCategory,
      factors: prediction.factors,
      ownerId: req.session?.user?.id || null,
      createdBy: req.session?.user?.fullName || 'system',
    }).returning();

    // Remove from quarantine
    await db.delete(quarantinedAssessments).where(eq(quarantinedAssessments.id, id));

    return res.json({ message: "Resolved and imported successfully", data: inserted });
  } catch (err) {
    console.error("Error resolving quarantined assessment:", err);
    return res.status(500).json({ message: "Failed to resolve" });
  }
});
