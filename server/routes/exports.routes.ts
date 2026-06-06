import { Router } from "express";
import { requireAuth, requireVerified } from "../auth";
import { storage } from "../storage";
import { assessmentsToCsv } from "../utils/csvExport";
import { exportLimiter } from "../middleware/rateLimit";

const exportsRouter = Router();

exportsRouter.get(
  "/export.csv",
  requireAuth,
  requireVerified,
  exportLimiter,
  async (req, res) => {
    try {
      const userEmail = req.session.user?.email;
      const assessments = await storage.getAssessments(1000, undefined, userEmail);

      const csv = assessmentsToCsv(
        assessments.data as unknown as Record<string, unknown>[]
      );

      res.header("Content-Type", "text/csv");
      res.attachment("assessments.csv");
      return res.send(csv);
    } catch (err) {
      console.error("Export error:", err);
      return res.status(500).json({ message: "Failed to export data" });
    }
  }
);

export default exportsRouter;
