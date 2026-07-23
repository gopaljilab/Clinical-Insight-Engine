import { Router } from "express";
import { getDb } from "../db";
import { smartGoals, assessments } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateSmartGoals } from "../services/smart-goals.service";

const router = Router();

// GET all goals for an assessment
router.get("/assessments/:id/goals", async (req, res) => {
  try {
    const assessmentId = parseInt(req.params.id);
    if (isNaN(assessmentId)) {
      return res.status(400).json({ message: "Invalid assessment ID" });
    }

    const goals = await getDb().query.smartGoals.findMany({
      where: eq(smartGoals.assessmentId, assessmentId),
      orderBy: (goals, { asc }) => [asc(goals.id)]
    });

    res.json(goals);
  } catch (error) {
    console.error("Error fetching goals:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST to generate goals for an assessment
router.post("/assessments/:id/goals/generate", async (req, res) => {
  try {
    const assessmentId = parseInt(req.params.id);
    if (isNaN(assessmentId)) {
      return res.status(400).json({ message: "Invalid assessment ID" });
    }

    // Check if goals already exist
    const existingGoals = await getDb().query.smartGoals.findMany({
      where: eq(smartGoals.assessmentId, assessmentId),
    });

    if (existingGoals.length > 0) {
      return res.json(existingGoals); // Return existing instead of overwriting
    }

    // Fetch assessment
    const assessment = await getDb().query.assessments.findFirst({
      where: eq(assessments.id, assessmentId),
    });

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    // Generate goals
    const generatedGoals = generateSmartGoals(assessment);
    
    // Insert into DB
    const insertedGoals = await getDb().insert(smartGoals).values(
      generatedGoals.map(g => ({
        ...g,
        assessmentId,
      })) as any
    ).returning();

    res.status(201).json(insertedGoals);
  } catch (error) {
    console.error("Error generating goals:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST to create a manual goal
router.post("/assessments/:id/goals", async (req, res) => {
  try {
    const assessmentId = parseInt(req.params.id);
    if (isNaN(assessmentId)) {
      return res.status(400).json({ message: "Invalid assessment ID" });
    }

    const { description, targetValue, dueDate, reminderDate, clinicianNotes, patientExplanation } = req.body;
    
    if (!description) {
      return res.status(400).json({ message: "Description is required" });
    }

    const [newGoal] = await getDb().insert(smartGoals).values({
      assessmentId,
      description,
      targetValue,
      dueDate: dueDate ? new Date(dueDate) : null,
      reminderDate: reminderDate ? new Date(reminderDate) : null,
      clinicianNotes,
      patientExplanation,
    } as any).returning();

    res.status(201).json(newGoal);
  } catch (error) {
    console.error("Error creating goal:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH to update a goal
router.patch("/goals/:id", async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    if (isNaN(goalId)) {
      return res.status(400).json({ message: "Invalid goal ID" });
    }

    const { status, targetValue, dueDate, reminderDate, clinicianNotes, description, patientExplanation } = req.body;
    
    const [updatedGoal] = await getDb().update(smartGoals)
      .set({
        ...(status !== undefined && { status }),
        ...(targetValue !== undefined && { targetValue }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(reminderDate !== undefined && { reminderDate: reminderDate ? new Date(reminderDate) : null }),
        ...(clinicianNotes !== undefined && { clinicianNotes }),
        ...(description !== undefined && { description }),
        ...(patientExplanation !== undefined && { patientExplanation }),
        updatedAt: new Date(),
      } as any)
      .where(eq(smartGoals.id, goalId))
      .returning();

    if (!updatedGoal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    res.json(updatedGoal);
  } catch (error) {
    console.error("Error updating goal:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE a goal
router.delete("/goals/:id", async (req, res) => {
  try {
    const goalId = parseInt(req.params.id);
    if (isNaN(goalId)) {
      return res.status(400).json({ message: "Invalid goal ID" });
    }

    const [deletedGoal] = await getDb().delete(smartGoals)
      .where(eq(smartGoals.id, goalId))
      .returning();

    if (!deletedGoal) {
      return res.status(404).json({ message: "Goal not found" });
    }

    res.json({ message: "Goal deleted successfully" });
  } catch (error) {
    console.error("Error deleting goal:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
