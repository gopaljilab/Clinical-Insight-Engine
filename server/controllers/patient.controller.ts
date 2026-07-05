import { type Request, type Response } from "express";
import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { logger } from "../logger";
import { issueToken } from "../services/auth/tokenValidator";
import { pendingOtps } from "../auth";
import { sendVerificationEmail } from "../email";

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

const verifyOtpSchema = z.object({
  email: z.string().email("Valid email is required"),
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
});

const PATIENT_SESSION_COOKIE = "patient_session";
const PATIENT_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

function setPatientSessionCookie(res: Response, token: string) {
  res.cookie(PATIENT_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: PATIENT_SESSION_MAX_AGE_MS,
    path: "/",
  });
}

export const registerPatient = async (req: Request, res: Response) => {
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
      emailVerified: false,
    });

    // Generate and store OTP
    const otp = randomInt(100000, 999999).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    pendingOtps.set(body.email, { otp, expiresAt, attempts: 0 });

    // Send verification email
    const emailSent = await sendVerificationEmail(body.email, otp);
    if (!emailSent) {
      logger.warn({ email: body.email }, "Failed to send patient verification email");
    }

    return res.status(201).json({
      success: true,
      requiresOTP: true,
      pendingEmail: body.email,
      message: "OTP sent to email. Verify to complete registration.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    logger.error({ err }, "Patient registration error");
    return res.status(500).json({ message: "Registration failed." });
  }
};

export const loginPatient = async (req: Request, res: Response) => {
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
      // Resend OTP and direct user to verify
      const otp = randomInt(100000, 999999).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000;
      pendingOtps.set(body.email, { otp, expiresAt, attempts: 0 });
      const emailSent = await sendVerificationEmail(body.email, otp);
      if (!emailSent) {
        logger.warn({ email: body.email }, "Failed to send patient verification email on login");
      }
      return res.status(403).json({
        message: "Email not verified. A verification code has been sent to your email.",
        requiresOTP: true,
        pendingEmail: body.email,
      });
    }
    const token = issueToken(user.id, user.email, "PATIENT", "24h");
    setPatientSessionCookie(res, token);
    return res.json({
      success: true,
      user: { id: user.id, patientName: user.patientName, email: user.email },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    logger.error({ err }, "Patient login error");
    return res.status(500).json({ message: "Login failed." });
  }
};

export const verifyPatientOTP = async (req: Request, res: Response) => {
  try {
    const body = verifyOtpSchema.parse(req.body);
    const pending = pendingOtps.get(body.email);

    if (!pending) {
      return res.status(400).json({ message: "No pending verification found for this email. Please register or sign in again." });
    }

    if (Date.now() > pending.expiresAt) {
      pendingOtps.delete(body.email);
      return res.status(400).json({ message: "OTP has expired. Please register or sign in again." });
    }

    if (pending.otp !== body.otp) {
      pending.attempts = (pending.attempts ?? 0) + 1;

      if (pending.attempts >= 3) {
        pendingOtps.delete(body.email);
        return res.status(429).json({
          message: "Too many failed attempts. Please register or sign in again.",
        });
      }

      const remaining = 3 - pending.attempts;
      return res.status(401).json({
        message: `Invalid OTP. ${remaining} attempt(s) remaining.`,
      });
    }

    // OTP is valid — mark email as verified
    pendingOtps.delete(body.email);
    const user = await storage.getPatientUserByEmail(body.email);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    await storage.updatePatientEmailVerified(user.id, true);

    // Issue JWT and set cookie
    const token = issueToken(user.id, user.email, "PATIENT", "24h");
    setPatientSessionCookie(res, token);

    return res.json({
      success: true,
      user: { id: user.id, patientName: user.patientName, email: user.email },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    logger.error({ err }, "Patient OTP verification error");
    return res.status(500).json({ message: "Verification failed." });
  }
};

export const getMe = async (req: Request, res: Response) => {
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
};

export const getAssessments = async (req: Request, res: Response) => {
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
};

export const getTrends = async (req: Request, res: Response) => {
  try {
    const user = await storage.getPatientUserById(req.jwtUser!.sub);
    if (!user) return res.status(404).json({ message: "User not found." });
    const trends = await storage.getPatientTrends(user.patientName);
    return res.json(trends);
  } catch (err) {
    logger.error({ err }, "Patient trends fetch error");
    return res.status(500).json({ message: "Failed to fetch trends." });
  }
};
