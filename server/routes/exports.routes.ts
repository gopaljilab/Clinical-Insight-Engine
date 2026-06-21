import { Router } from "express";
import { logger } from "../logger";
import { requireAuth, requireVerified } from "../auth";
import { storage } from "../storage";
import { assessmentsToCsv } from "../utils/csvExport";
import { exportLimiter } from "../middleware/rateLimit";
import { assessmentExportQuerySchema } from "../validation/searchValidation";

const exportsRouter = Router();

exportsRouter.get(
  "/export.csv",
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
      logger.error({ err }, "Export error");
      return res.status(500).json({ message: "Failed to export data" });
    }
  }
);

export default exportsRouter;
