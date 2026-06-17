import { Router } from "express";
import { logger } from "../logger";
import { requireAuth, requireVerified } from "../auth";
import { storage } from "../storage";

const analyticsRouter = Router();

analyticsRouter.get(
  "/analytics",
  requireAuth,
  requireVerified,
  async (req, res) => {
    try {
      const userEmail = req.session.user?.email;
      if (!userEmail) {
         return res.status(401).json({ message: "Unauthorized" });
      }
      const stats = await storage.getAnalyticsStats(userEmail);
      return res.json(stats);
    } catch (err) {
      logger.error({ err }, "Analytics fetch error");
      return res.status(500).json({ message: "Failed to fetch analytics" });
    }
  }
);

export default analyticsRouter;
