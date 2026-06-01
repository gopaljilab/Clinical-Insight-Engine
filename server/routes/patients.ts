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
    const userId = req.jwtUser?.sub;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Return the user's assessments as their "patients" dataset
    // Drizzle ORM ensures this parameter is bound, not concatenated
    const records = await storage.getAssessments(50, 0, userId);
    
    res.json({ data: records });
  } catch (error) {
    next(error);
  }
});

export default router;
