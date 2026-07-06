import { Router, type Request, type Response, type NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { verifyToken } from "../services/auth/tokenValidator";
import {
  registerPatient,
  loginPatient,
  verifyPatientOTP,
  getMe,
  getAssessments,
  getTrends,
} from "../controllers/patient.controller";

const router = Router();

const PATIENT_SESSION_COOKIE = "patient_session";

const patientAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

const verifyOtpLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Please try again later." },
});

function getCookieValue(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function getPatientToken(req: Request): string | undefined {
  const cookieToken = getCookieValue(req, PATIENT_SESSION_COOKIE);
  if (cookieToken) return decodeURIComponent(cookieToken);

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return undefined;
}

export function requirePatientAuth(req: Request, res: Response, next: NextFunction) {
  const token = getPatientToken(req);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const result = verifyToken(token);
  if (!result.valid) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (result.payload.role !== "PATIENT") {
    return res.status(403).json({ error: "Forbidden" });
  }
  req.jwtUser = result.payload;
  next();
}

router.post("/auth/register", patientAuthLimiter, registerPatient);
router.post("/auth/login", patientAuthLimiter, loginPatient);
router.post("/auth/verify-otp", verifyOtpLimiter, verifyPatientOTP);
router.post("/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie(PATIENT_SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  return res.json({ success: true });
});
router.get("/auth/me", requirePatientAuth, getMe);
router.get("/assessments", requirePatientAuth, getAssessments);
router.get("/trends", requirePatientAuth, getTrends);

export default router;
