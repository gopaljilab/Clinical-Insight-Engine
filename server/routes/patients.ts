import { Router, type Request, type Response, type NextFunction } from "express";
import { requireJwtAuth } from "../middleware/jwtVerification";
import { storage } from "../storage";
import { logger } from "../logger";

const router = Router();

// ALL routes in this router require a valid JWT
router.use(requireJwtAuth);

router.get("/", async (req, res, next) => {
  try {
    // Identity is authoritative from the verified token
    const userEmail = req.jwtUser?.email;
    
    if (!userEmail) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Return the user's assessments as their "patients" dataset
    // Drizzle ORM ensures this parameter is bound, not concatenated
    const records = await storage.getAssessments(50, undefined, userEmail);
    const sanitizedRecords = records.data.map((record: any) => {
      const { userId, createdBy, ...rest } = record;
      return rest;
    });

    res.json({ data: sanitizedRecords });
  } catch (err) {
    logger.error({ err }, "Patient routes fetch error");
    next(err);
  }
});

router.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err }, "Patient routes error");
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

export default router;
