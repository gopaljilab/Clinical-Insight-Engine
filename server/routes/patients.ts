import { Router } from "express";
import { requireJwtAuth } from "../middleware/jwtVerification";
import { DatabaseStorage } from "../storage";

const router = Router();
const storage = new DatabaseStorage();

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
  } catch (error) {
    next(error);
  }
});

export default router;
