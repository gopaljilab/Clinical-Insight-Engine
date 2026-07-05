import { Router } from "express";
import { requireAuth } from "../auth";
import { getDb } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validateDTO } from "../middleware/validateDTO";

const router = Router();

const updateSettingsSchema = z.object({
  reportFrequency: z.enum(["none", "daily", "weekly"]),
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.id));

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ reportFrequency: user.reportFrequency });
  } catch (error) {
    res.status(500).json({ message: "Failed to get settings" });
  }
});

router.patch("/", requireAuth, validateDTO(updateSettingsSchema), async (req, res) => {
  try {
    const { reportFrequency } = req.body;
    const db = getDb();

    const [updatedUser] = await db
      .update(users)
      .set({ reportFrequency })
      .where(eq(users.id, req.user!.id))
      .returning();

    res.json({ reportFrequency: updatedUser.reportFrequency });
  } catch (error) {
    res.status(500).json({ message: "Failed to update settings" });
  }
});

export default router;
