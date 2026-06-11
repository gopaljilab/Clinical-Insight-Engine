import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { storage } from "../storage";
import { logger } from "../logger";
import { issueToken, verifyToken } from "../services/auth/tokenValidator";

const router = Router();

const patientAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

const registerSchema = z.object({
  patientName: z.string().trim().min(1, "Patient name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

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

router.post("/auth/register", patientAuthLimiter, async (req: Request, res: Response) => {
  try {
    const body = registerSchema.parse(req.body);
    const existing = await storage.getPatientUserByEmail(body.email);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }
    const existingByName = await storage.getPatientUserByPatientName(body.patientName);
    if (existingByName) {
      return res.status(409).json({ message: "This patient name is already registered." });
    }
    const passwordHash = hashPassword(body.password);
    const user = await storage.createPatientUser({
      patientName: body.patientName,
      email: body.email,
      passwordHash,
      phone: body.phone ?? null,
      isActive: true,
      emailVerified: true,
    });
    const token = issueToken(user.id, user.email, "PATIENT", "24h");
    return res.status(201).json({
      success: true,
      token,
      user: { id: user.id, patientName: user.patientName, email: user.email },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    logger.error({ err }, "Patient registration error");
    return res.status(500).json({ message: "Registration failed." });
  }
});

router.post("/auth/login", patientAuthLimiter, async (req: Request, res: Response) => {
  try {
    const body = loginSchema.parse(req.body);
    const user = await storage.getPatientUserByEmail(body.email);
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    if (!user.isActive) {
      return res.status(403).json({ message: "Account is deactivated." });
    }
    const token = issueToken(user.id, user.email, "PATIENT", "24h");
    return res.json({
      success: true,
      token,
      user: { id: user.id, patientName: user.patientName, email: user.email },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    logger.error({ err }, "Patient login error");
    return res.status(500).json({ message: "Login failed." });
  }
});

router.get("/auth/me", requirePatientAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getPatientUserById(req.jwtUser!.sub);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    return res.json({
      user: { id: user.id, patientName: user.patientName, email: user.email },
    });
  } catch (err) {
    logger.error({ err }, "Patient me error");
    return res.status(500).json({ message: "Failed to fetch user." });
  }
});

router.get("/assessments", requirePatientAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getPatientUserById(req.jwtUser!.sub);
    if (!user) return res.status(404).json({ message: "User not found." });
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const result = await storage.getAssessmentsByPatientName(user.patientName, limit, offset);
    return res.json(result);
  } catch (err) {
    logger.error({ err }, "Patient assessments fetch error");
    return res.status(500).json({ message: "Failed to fetch assessments." });
  }
});

router.get("/trends", requirePatientAuth, async (req: Request, res: Response) => {
  try {
    const user = await storage.getPatientUserById(req.jwtUser!.sub);
    if (!user) return res.status(404).json({ message: "User not found." });
    const trends = await storage.getPatientTrends(user.patientName);
    return res.json(trends);
  } catch (err) {
    logger.error({ err }, "Patient trends fetch error");
    return res.status(500).json({ message: "Failed to fetch trends." });
  }
});

export default router;
