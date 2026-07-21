import { Router } from "express";
import { logger } from "../logger";
import { requireAuth, requireVerified } from "../auth";
import { storage } from "../storage";
import { cohortQuerySchema } from "../validation/searchValidation";

const analyticsRouter = Router();

analyticsRouter.get(
  "/analytics",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const userEmail = req.session.user?.email;
      if (!userEmail) {
         return res.status(401).json({ message: "api.errors.unauthorized" });
      }
      const parsed = cohortQuerySchema.safeParse(req.query);
      const cohortFilters = parsed.success ? parsed.data : undefined;
      const stats = await storage.getAnalyticsStats(userEmail, cohortFilters);
      return res.json(stats);
    } catch (err) {
      logger.error({ err }, "Analytics fetch error");
      return res.status(500).json({ message: "api.errors.failedToFetchAnalytics" });
    }
  }
);

export default analyticsRouter;
