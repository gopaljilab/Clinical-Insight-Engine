import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { verifyToken } from "../services/auth/tokenValidator";
import {
  registerPatient,
  loginPatient,
  getMe,
  getAssessments,
  getTrends
} from "../controllers/patient.controller";

const router = Router();

const patientAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

function requirePatientAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.slice(7);
  const result = verifyToken(token);
  if (!result.valid) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.jwtUser = result.payload;
  next();
}

router.post("/auth/register", patientAuthLimiter, registerPatient);
router.post("/auth/login", patientAuthLimiter, loginPatient);
router.get("/auth/me", requirePatientAuth, getMe);
router.get("/assessments", requirePatientAuth, getAssessments);
router.get("/trends", requirePatientAuth, getTrends);

export default router;
