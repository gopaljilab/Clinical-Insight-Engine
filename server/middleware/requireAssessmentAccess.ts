import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { canAccessPatientRecord } from "../services/authz/patient-access";
import { logAccessAttempt } from "../security/access-audit";
import { logger } from "../logger";

declare global {
  namespace Express {
    interface Request {
      assessment?: any;
    }
  }
}

export async function requireAssessmentAccess(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = parseInt(req.params.id as string, 10);

    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ message: "Invalid assessment ID." });
    }

    const user = (req as any).session?.user || (req as any).jwtUser;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const assessment = await storage.getAssessmentById(id);

    if (!assessment) {
      return res.status(404).json({ message: "Assessment not found." });
    }

    if (!canAccessPatientRecord(user, assessment)) {
      logAccessAttempt(
        (user as any).id,
        "Assessment",
        id,
        false,
        "IDOR attempt: User not authorized to access this patient record"
      );
      return res.status(404).json({ message: "Assessment not found." });
    }

    logAccessAttempt(
      (user as any).id,
      "Assessment",
      id,
      true,
      "Authorized access"
    );

    req.assessment = assessment;
    next();
  } catch (err) {
    logger.error({ err }, "Assessment access check error:");
    return res.status(500).json({ message: "Internal server error" });
  }
}
