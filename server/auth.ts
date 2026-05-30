import { Router, type Request, type Response, type NextFunction } from "express";
import { randomInt, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { getDb } from "./db";
import { users, emailVerificationTokens } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";
import { sendVerificationCode } from "./email";
import { rateLimit } from "express-rate-limit";

// Extend express-session to include user data
declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      name: string;
    };
  }
}

interface PendingOtp {
  otp: string;
  expiresAt: number;
}

/**
 * In-memory OTP store keyed by email.
 * Each entry expires after 10 minutes.
 */
const pendingOtps = new Map<string, PendingOtp>();

/**
 * Rate limiters for verification endpoints.
 */
const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Please try again later." },
});

const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many resend requests. Please try again later." },
});

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return hash.length === Buffer.from(key, "hex").length && timingSafeEqual(hash, Buffer.from(key, "hex"));
}

function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

function logDevOtp(email: string, otp: string): void {
  if (process.env.NODE_ENV !== "production") {
    const border = "=".repeat(44);
    console.log(`\n${border}`);
    console.log("  EMAIL VERIFICATION");
    console.log(`  To: ${email}`);
    console.log(`  Verification Code: ${otp}`);
    console.log(`${border}\n`);
  }
}

/**
 * Creates an authentication router with login, register, logout, session-check,
 * email verification, and resend endpoints.
 */
export function createAuthRouter(): Router {
  const router = Router();

  // ─── Registration ──────────────────────────────────────────────────────

  /**
   * POST /api/auth/register
   * Validates registration fields, creates a new user account,
   * generates a verification OTP, and sends it to the user's email.
   */
  router.post("/register", async (req: Request, res: Response) => {
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

    const existing = await storage.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    // Check DB for existing user
    try {
      const db = getDb();
      const [existingDbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingDbUser) {
        return res.status(409).json({ message: "An account with this email already exists." });
      }
    registeredUsers.set(email, {
      fullName,
      email,
      passwordHash,
      medicalLicenseNumber: licenseNumber,
    });

      // Create DB user
      const passwordHash = hashPassword(password);
      const [newUser] = await db
        .insert(users)
        .values({
          fullName,
          email,
          medicalLicenseNumber: licenseNumber,
          passwordHash,
          emailVerified: false,
          role: "provider",
        })
        .returning();

      // Create email verification token
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.insert(emailVerificationTokens).values({
        userId: newUser.id,
        verificationCode: otp,
        expiresAt,
        used: false,
        attemptCount: 0,
      });

      await sendVerificationCode(email, otp);

      return res.status(201).json({
        success: true,
        pendingEmail: email,
        ...(process.env.NODE_ENV !== "production" && { devOtp: otp }),
      });
    } catch (err) {
      console.error("Registration error:", err);
      return res.status(500).json({ message: "Registration failed due to a server error." });
    }
  });

  // ─── Login ──────────────────────────────────────────────────────────────

  /**
   * POST /api/auth/login
   * Validates email/password and sends a verification OTP.
   */
  router.post("/login", async (req: Request, res: Response) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const devEmail = process.env.DEV_CLINICIAN_EMAIL || "";
    const devPassword = process.env.DEV_CLINICIAN_PASSWORD || "";

    let userFullName: string | null = null;

    if (email === devEmail && password === devPassword) {
      userFullName = "Dr. Smith";
    } else {
      // Check in-memory store (legacy)
      const registeredUser = registeredUsers.get(email);
      if (registeredUser && bcrypt.compareSync(password, registeredUser.password)) {
        userName = registeredUser.fullName;
      }

      // Also check DB
      if (!userName) {
        try {
          const db = getDb();
          const [dbUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (dbUser && verifyPassword(password, dbUser.passwordHash)) {
            userName = dbUser.fullName;
          }
        } catch (err) {
          // DB not available — fall back to in-memory only
          console.warn("DB unavailable for login, using in-memory only.");
        }
      }
    }

    if (!userFullName) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const otp = generateOtp();
    pendingOtps.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

    logDevOtp(email, otp);

    return res.json({
      success: true,
      pendingEmail: email,
      ...(process.env.NODE_ENV !== "production" && { devOtp: otp }),
    });
  });

  // ─── OTP Verification (Legacy in-memory) ──────────────────────────────

  /**
   * POST /api/auth/verify-otp
   * Verifies the OTP sent after login/register and establishes a session.
   */
  router.post("/verify-otp", async (req: Request, res: Response) => {
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

    const devEmail = process.env.DEV_CLINICIAN_EMAIL || "";

    let id: string;
    let name: string;

    if (email === devEmail) {
      name = "Dr. Smith";
      id = "dev";
    } else {
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      id = user.id;
      name = user.fullName;
    }

    req.session.user = { id, email, name };

    return res.json({ success: true, user: { id, email, name } });
  });

  // ─── Email Verification (DB-backed) ────────────────────────────────────

  /**
   * POST /api/auth/verify-email
   * Validates a 6-digit OTP against the email_verification_tokens table.
   * On success, marks the user as verified and creates a session.
   *
   * Security:
   * - OTP expires after 10 minutes
   * - OTP can only be used once
   * - Maximum 5 verification attempts per token
   * - Rate limited to 10 requests/minute
   */
  router.post("/verify-email", verifyEmailLimiter, async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body || {};

      if (!email || !code) {
        return res.status(400).json({ message: "Email and verification code are required." });
      }

      if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: "Verification code must be a 6-digit number." });
      }

      const db = getDb();

      // Find the user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      // If already verified, return success
      if (user.emailVerified) {
        req.session.user = { email: user.email, name: user.fullName };
        return res.json({ success: true, message: "Email already verified." });
      }

      // Find an active, unexpired, unused token for this user
      const [token] = await db
        .select()
        .from(emailVerificationTokens)
        .where(
          and(
            eq(emailVerificationTokens.userId, user.id),
            eq(emailVerificationTokens.used, false),
            gte(emailVerificationTokens.expiresAt, new Date()),
          ),
        )
        .orderBy(emailVerificationTokens.createdAt)
        .limit(1);

      if (!token) {
        return res.status(400).json({
          message: "No valid verification code found. Please request a new code.",
        });
      }

      // Check attempt count
      const maxAttempts = 5;
      if ((token.attemptCount ?? 0) >= maxAttempts) {
        // Mark token as used to force a new one
        await db
          .update(emailVerificationTokens)
          .set({ used: true })
          .where(eq(emailVerificationTokens.id, token.id));

        return res.status(429).json({
          message: "Too many failed attempts. Please request a new verification code.",
        });
      }

      // Validate the code
      if (token.verificationCode !== code) {
        // Increment attempt count
        await db
          .update(emailVerificationTokens)
          .set({ attemptCount: (token.attemptCount ?? 0) + 1 })
          .where(eq(emailVerificationTokens.id, token.id));

        const remaining = maxAttempts - (token.attemptCount ?? 0) - 1;
        return res.status(401).json({
          message: `Invalid code. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : "Please request a new code."}`,
        });
      }

      // Code is valid — mark token as used and user as verified
      await db
        .update(emailVerificationTokens)
        .set({ used: true })
        .where(eq(emailVerificationTokens.id, token.id));

      await db
        .update(users)
        .set({ emailVerified: true, emailVerifiedAt: new Date() })
        .where(eq(users.id, user.id));

      // Create session
      req.session.user = { email: user.email, name: user.fullName };

      return res.json({ success: true, message: "Email verified successfully." });
    } catch (err) {
      console.error("Email verification error:", err);
      return res.status(500).json({ message: "Verification failed due to a server error." });
    }
  });

  // ─── Resend Verification ──────────────────────────────────────────────

  /**
   * POST /api/auth/resend-verification
   * Invalidates the existing OTP, generates a new one, and sends it.
   *
   * Rate limited to 3 requests per hour.
   */
  router.post("/resend-verification", resendLimiter, async (req: Request, res: Response) => {
    try {
      const { email } = req.body || {};

      if (!email) {
        return res.status(400).json({ message: "Email is required." });
      }

      const db = getDb();

      // Find the user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (user.emailVerified) {
        return res.json({ success: true, message: "Email is already verified." });
      }

      // Invalidate all existing unused tokens for this user
      await db
        .update(emailVerificationTokens)
        .set({ used: true })
        .where(
          and(
            eq(emailVerificationTokens.userId, user.id),
            eq(emailVerificationTokens.used, false),
          ),
        );

      // Generate new OTP
      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await db.insert(emailVerificationTokens).values({
        userId: user.id,
        verificationCode: code,
        expiresAt,
        used: false,
        attemptCount: 0,
      });

      await sendVerificationCode(email, code);

      return res.json({
        success: true,
        message: "A new verification code has been sent.",
        ...(process.env.NODE_ENV !== "production" && { devOtp: code }),
      });
    } catch (err) {
      console.error("Resend verification error:", err);
      return res.status(500).json({ message: "Failed to resend verification code." });
    }
  });

  // ─── Logout ──────────────────────────────────────────────────────────

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

  // ─── Session Check ──────────────────────────────────────────────────

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
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.user) {
    return next();
  }
  return res.status(401).json({ message: "Authentication required." });
}

/**
 * Express middleware that blocks requests from users whose email
 * has not been verified. Must be used after requireAuth.
 */
export async function requireVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user?.email) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const db = getDb();
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, req.session.user.email))
      .limit(1);

    // If not in DB (e.g. dev clinician bypass), allow through
    if (!user || user.emailVerified) {
      return next();
    }

    return res.status(403).json({
      message: "Email not verified. Please verify your email before accessing this resource.",
      needsVerification: true,
      email: req.session.user.email,
    });
  } catch (err) {
    console.error("requireVerified error:", err);
    return res.status(500).json({ message: "Failed to verify user status." });
  }
}


