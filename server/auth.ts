import { Router, type Request, type Response, type NextFunction } from "express";
import { randomInt } from "crypto";

// Extend express-session to include user data
declare module "express-session" {
  interface SessionData {
    user?: {
      email: string;
      name: string;
    };
  }
}

interface RegisteredUser {
  fullName: string;
  email: string;
  password: string;
  licenseNumber: string;
}

/**
 * In-memory store for registered users.
 * In production, this should be replaced with a persistent database.
 */
const registeredUsers = new Map<string, RegisteredUser>();

interface PendingOtp {
  otp: string;
  expiresAt: number;
}

/**
 * In-memory OTP store keyed by email.
 * Each entry expires after 10 minutes.
 */
const pendingOtps = new Map<string, PendingOtp>();

function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

function logDevOtp(email: string, otp: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV] OTP for ${email}: ${otp}`);
  }
}

/**
 * Creates an authentication router with login, register, logout, and session-check endpoints.
 *
 * In development mode, credentials are validated against environment variables
 * (DEV_CLINICIAN_EMAIL / DEV_CLINICIAN_PASSWORD). In production, this serves
 * as the auth gateway for all protected API routes.
 */
export function createAuthRouter(): Router {
  const router = Router();

  /**
   * POST /api/auth/register
   * Validates registration fields, creates a new user account, and establishes a session.
   */
  router.post("/register", (req: Request, res: Response) => {
    const { fullName, email, password, licenseNumber } = req.body || {};

    if (!fullName || !email || !password || !licenseNumber) {
      return res.status(400).json({
        message: "Full name, email, password, and license number are required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    if (registeredUsers.has(email)) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    registeredUsers.set(email, { fullName, email, password, licenseNumber });

    const otp = generateOtp();
    pendingOtps.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    // In production, send OTP via email. For development, return it in the response.
    logDevOtp(email, otp);

    return res.status(201).json({ success: true, pendingEmail: email, ...(process.env.NODE_ENV !== "production" && { devOtp: otp }) });
  });

  /**
   * POST /api/auth/login
   * Validates email/password against server-side env vars or registered users and creates a session.
   */
  router.post("/login", (req: Request, res: Response) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const devEmail = process.env.DEV_CLINICIAN_EMAIL || "";
    const devPassword = process.env.DEV_CLINICIAN_PASSWORD || "";

    let userName: string | null = null;

    if (email === devEmail && password === devPassword) {
      userName = "Dr. Smith";
    } else {
      const registeredUser = registeredUsers.get(email);
      if (registeredUser && registeredUser.password === password) {
        userName = registeredUser.fullName;
      }
    }

    if (!userName) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const otp = generateOtp();
    pendingOtps.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    // In production, send OTP via email. For development, return it in the response.
    logDevOtp(email, otp);

    return res.json({ success: true, pendingEmail: email, ...(process.env.NODE_ENV !== "production" && { devOtp: otp }) });
  });

  /**
   * POST /api/auth/verify-otp
   * Verifies the OTP sent after login/register and establishes a session.
   */
  router.post("/verify-otp", (req: Request, res: Response) => {
    const { email, otp } = req.body || {};

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const pending = pendingOtps.get(email);

    if (!pending) {
      return res.status(400).json({ message: "No pending verification found for this email." });
    }

    if (Date.now() > pending.expiresAt) {
      pendingOtps.delete(email);
      return res.status(400).json({ message: "OTP has expired. Please sign in again." });
    }

    if (pending.otp !== otp) {
      return res.status(401).json({ message: "Invalid OTP. Please try again." });
    }

    pendingOtps.delete(email);

    const registeredUser = registeredUsers.get(email);
    const devEmail = process.env.DEV_CLINICIAN_EMAIL || "";
    const name = email === devEmail ? "Dr. Smith" : (registeredUser?.fullName ?? email);

    req.session.user = { email, name };

    return res.json({ success: true, user: { email, name } });
  });

  /**
   * POST /api/auth/logout
   * Destroys the current session and clears the session cookie.
   */
  router.post("/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction failed:", err);
        return res.status(500).json({ message: "Failed to logout." });
      }
      res.clearCookie("connect.sid");
      return res.json({ success: true });
    });
  });

  /**
   * GET /api/auth/me
   * Returns the current authenticated user's info if the session is valid.
   */
  router.get("/me", (req: Request, res: Response) => {
    if (req.session.user) {
      return res.json({ user: req.session.user });
    }
    return res.status(401).json({ message: "Not authenticated." });
  });

  return router;
}

/**
 * Express middleware that blocks unauthenticated requests.
 * Attach this to any route that requires a valid session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.user) {
    return next();
  }
  return res.status(401).json({ message: "Authentication required." });
}
