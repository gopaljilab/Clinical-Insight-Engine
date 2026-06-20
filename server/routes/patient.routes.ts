import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { storage } from "../storage";
import { logger } from "../logger";
import { issueToken, verifyToken } from "../services/auth/tokenValidator";
import { sendVerificationEmail } from "../email";

const router = Router();

const patientAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

const verificationStore = new Map<string, { code: string; expiresAt: number }>();

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeVerificationCode(email: string, code: string): void {
  verificationStore.set(email.toLowerCase(), { code, expiresAt: Date.now() + 10 * 60 * 1000 });
}

function getVerificationCode(email: string): string | null {
  const entry = verificationStore.get(email.toLowerCase());
  if (!entry || entry.expiresAt < Date.now()) {
    verificationStore.delete(email.toLowerCase());
    return null;
  }
  return entry.code;
}

function removeVerificationCode(email: string): void {
  verificationStore.delete(email.toLowerCase());
}

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "123456", "1234567", "12345678",
  "123456789", "1234567890", "qwerty", "qwerty123", "abc123", "abcdef",
  "letmein", "welcome", "monkey", "dragon", "master", "admin", "login",
  "passw0rd", "trustno1", "sunshine", "princess", "football", "iloveyou",
  "shadow", "superman", "michael", "ninja", "mustang", "batman", "charlie",
]);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
  .refine((val) => !COMMON_PASSWORDS.has(val.toLowerCase()), {
    message: "This password is too common and easily guessed. Please choose a more unique password.",
  });

const registerSchema = z.object({
  patientName: z.string().trim().min(1, "Patient name is required"),
  email: z.string().email("Valid email is required"),
  password: passwordSchema,
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
    await storage.createPatientUser({
      patientName: body.patientName,
      email: body.email,
      passwordHash,
      phone: body.phone ?? null,
      isActive: true,
      emailVerified: false,
    });
    const code = generateVerificationCode();
    storeVerificationCode(body.email, code);
    await sendVerificationEmail(body.email, code);
    return res.status(201).json({
      message: "Account created. Please check your email for a verification code.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    logger.error({ err }, "Patient registration error");
    return res.status(500).json({ message: "Registration failed." });
  }
});

router.post("/auth/verify-email", patientAuthLimiter, async (req: Request, res: Response) => {
  try {
    const { email, code } = z.object({
      email: z.string().email(),
      code: z.string().length(6),
    }).parse(req.body);

    const storedCode = getVerificationCode(email);
    if (!storedCode || storedCode !== code) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    removeVerificationCode(email);
    const user = await storage.getPatientUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
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
    logger.error({ err }, "Email verification error");
    return res.status(500).json({ message: "Verification failed." });
  }
});

router.post("/auth/resend-code", patientAuthLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await storage.getPatientUserByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "No account found with this email." });
    }
    if (user.emailVerified) {
      return res.status(400).json({ message: "Email is already verified. Please log in." });
    }
    const code = generateVerificationCode();
    storeVerificationCode(email, code);
    await sendVerificationEmail(email, code);
    return res.json({ message: "Verification code resent. Please check your email." });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    logger.error({ err }, "Resend code error");
    return res.status(500).json({ message: "Failed to resend code." });
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
    if (!user.emailVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in.", needsVerification: true });
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
