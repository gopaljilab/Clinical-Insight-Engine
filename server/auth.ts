import { Router, type Request, type Response, type NextFunction } from "express";
import { randomInt } from "crypto";
import bcrypt from "bcrypt";
import { rateLimit } from "express-rate-limit";
import { eq, and, gte } from "drizzle-orm";
import { storage } from "./storage";
import { getDb } from "./db";
import { users, emailVerificationTokens, passwordResetTokens } from "@shared/schema";
import { sendVerificationCode } from "./email";
// Extend express-session to include user data
declare module "express-session" {
  interface SessionData {
    user?: {
      id: string;
      email: string;
      name: string;
      role?: string | null;
      emailVerified: boolean;
    };
  }
}

interface RegisteredUser {
  fullName: string;
  email: string;
  passwordHash: string;
  licenseNumber: string;
}

// removed duplicated functions

/**
 * In-memory store for registered users.
 * In production, this should be replaced with a persistent database.
 */
const registeredUsers = new Map<string, RegisteredUser>();

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password: string, storedHash: string): boolean {
  return bcrypt.compareSync(password, storedHash);
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

function normalizeRateLimitEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Builds a stable OTP rate-limit key from the submitted email when present,
 * falling back to the client IP for malformed or incomplete requests.
 */
function ipKeyGenerator(ip: string): string {
  return ip;
}

export function getOtpRateLimitKey(req: Pick<Request, "body" | "ip">): string {
  const email = normalizeRateLimitEmail(req.body?.email);

  if (email) {
    return `otp:${email}`;
  }

  return `otp:ip:${ipKeyGenerator(req.ip ?? "unknown")}`;
}

/**
 * Periodically removes expired OTP entries to prevent unbounded memory growth.
 * Runs every 5 minutes.
 */
const otpCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [email, otp] of pendingOtps) {
    if (now > otp.expiresAt) {
      pendingOtps.delete(email);
    }
  }
}, 5 * 60 * 1000);
if (otpCleanupTimer.unref) {
  otpCleanupTimer.unref();
}

/**
 * Rate limiters for verification endpoints.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Stricter limit to prevent brute force (Fixes #624)
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: getOtpRateLimitKey,
  message: { error: "Too many OTP verification attempts. Please try again later." },
});

const verifyEmailLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login/registration attempts. Please try again in 15 minutes." },
});

const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many resend requests. Please try again later." },
});

function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

function logDevOtp(email: string, otp: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV] OTP for ${email}: ${otp}`);
  }
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });
}

async function establishAuthenticatedSession(
  req: Request,
  user: { id: string; email: string; name: string; role?: string | null; emailVerified: boolean },
): Promise<void> {
  await regenerateSession(req);
  req.session.user = user;
  await saveSession(req);
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
  router.post("/register", authLimiter, async (req: Request, res: Response) => {
    const { fullName, licenseNumber } = req.body || {};
    const email = (req.body?.email ?? "").trim().toLowerCase();
    const password = req.body?.password ?? "";
 
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

    if (fullName.length > 255) {
      return res.status(400).json({ message: "Full name must be 255 characters or less." });
    }

    if (licenseNumber.length > 100) {
      return res.status(400).json({ message: "Medical license number must be 100 characters or less." });
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

      const passwordHash = hashPassword(password);

      // Create email verification token
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      let registeredUserId: string;

      await db.transaction(async (tx) => {
        // Create DB user
        const [newUser] = await tx
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

        // Cache in-memory for legacy login flow
        registeredUsers.set(email, {
          fullName,
          email,
          passwordHash,
          licenseNumber,
        });
        registeredUserId = newUser.id;

        // Create email verification token
        await tx.insert(emailVerificationTokens).values({
          userId: newUser.id,
          verificationCode: otp,
          expiresAt,
          used: false,
          attemptCount: 0,
        });

        // Send verification email
        await sendVerificationCode(email, otp);
      });

      // In production, send OTP via email. For development, return it in the response.
      logDevOtp(email, otp);

      await storage.recordLoginAudit({
        userId: registeredUserId!,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        loginStatus: "registration",
      });

      return res.status(201).json({ success: true, pendingEmail: email, ...(process.env.NODE_ENV !== "production" && { devOtp: otp }) });
    } catch (err) {
      console.error("Registration error:", err);
      return res.status(500).json({ message: "Registration failed due to a server error." });
    }
  });

  /**
   * POST /api/auth/login
   * Validates email/password against server-side env vars or registered users and creates a session.
   */
  router.post("/login", authLimiter, async (req: Request, res: Response) => {
    const rawEmail = req.body?.email ?? "";
    const email = rawEmail.trim().toLowerCase();
    const password = req.body?.password ?? "";

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const devEmail = process.env.DEV_CLINICIAN_EMAIL || "";
    const devPassword = process.env.DEV_CLINICIAN_PASSWORD || "";

    let userName: string | null = null;

    if (email === devEmail && password === devPassword) {
      userName = "Dr. Smith";
    } else {
      // Check in-memory store (legacy)
      const registeredUser = registeredUsers.get(email);
      if (registeredUser && verifyPassword(password, registeredUser.passwordHash)) {
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
        } catch (_err) {
          // DB not available — fall back to in-memory only
          console.warn("DB unavailable for login, using in-memory only.");
          const registeredUser = registeredUsers.get(email);
          if (registeredUser && verifyPassword(password, registeredUser.passwordHash)) {
            userName = registeredUser.fullName;
          }
        }
      }
    }


    if (!userName) {
      await storage.recordLoginAudit({
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        loginStatus: "login_failed",
      });
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
  router.post("/verify-otp", otpLimiter, async (req: Request, res: Response) => {
    const { otp } = req.body || {};
    const email = (req.body?.email ?? "").trim().toLowerCase();

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    const pending = pendingOtps.get(email);

    if (!pending) {
      await storage.recordLoginAudit({
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        loginStatus: "otp_failed",
      });
      return res.status(400).json({ message: "No pending verification found for this email." });
    }

    if (Date.now() > pending.expiresAt) {
      pendingOtps.delete(email);
      await storage.recordLoginAudit({
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        loginStatus: "otp_expired",
      });
      return res.status(400).json({ message: "OTP has expired. Please sign in again." });
    }

    if (pending.otp !== otp) {
      await storage.recordLoginAudit({
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        loginStatus: "otp_failed",
      });
      return res.status(401).json({ message: "Invalid OTP. Please try again." });
    }

    pendingOtps.delete(email);

    const devEmail = process.env.DEV_CLINICIAN_EMAIL || "";

    let id: string;
    let name: string;
    let role: string;

    let emailVerified = false;

    if (email === devEmail) {
      name = "Dr. Smith";
      id = "dev";
      role = "provider";
      emailVerified = true;
    } else {
      const db = getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      id = user.id;
      name = user.fullName;
      role = user.role ?? "provider";
      emailVerified = user.emailVerified ?? false;
    }

    try {
      await establishAuthenticatedSession(req, { id, email, name, role, emailVerified });
    } catch (error) {
      console.error("Session regeneration failed:", error);
      return res.status(500).json({ message: "Failed to establish session." });
    }

    await storage.recordLoginAudit({
      userId: id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      loginStatus: "login_success",
    });

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
        await establishAuthenticatedSession(req, { id: user.id, email: user.email, name: user.fullName, role: user.role ?? "provider", emailVerified: true });
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

      await establishAuthenticatedSession(req, { id: user.id, email: user.email, name: user.fullName, role: user.role ?? "provider", emailVerified: true });

      await storage.recordLoginAudit({
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        loginStatus: "email_verified",
      });

      return res.json({ success: true, message: "Email verified successfully." });
    } catch (err) {
      console.error("Email verification error:", err);
      return res.status(500).json({ message: "Verification failed due to a server error." });
    }
  });

  /**
   * POST /api/auth/logout
   * Destroys the current session and clears the session cookie.
   */
  router.post("/logout", async (req: Request, res: Response) => {
    await storage.recordLoginAudit({
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      loginStatus: "logout",
    });

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

  /**
   * POST /api/auth/forgot-password
   * Accepts email, creates a password reset token, and logs the reset link.
   */
  router.post("/forgot-password", async (req: Request, res: Response) => {
    const email = (req.body?.email ?? "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    try {
      const db = getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "No account found with this email." });
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        token,
        expiresAt,
        used: false,
      });

      const resetLink = `${process.env.APP_URL || "http://localhost:5173"}/reset-password?token=${token}`;

      if (process.env.NODE_ENV !== "production") {
        const border = "=".repeat(44);
        console.log(`\n${border}`);
        console.log("  PASSWORD RESET");
        console.log(`  To: ${email}`);
        console.log(`  Link: ${resetLink}`);
        console.log(`${border}\n`);
      }

      return res.json({ success: true, message: "If an account exists, a reset link has been sent." });
    } catch (err) {
      console.error("Forgot password error:", err);
      return res.status(500).json({ message: "Failed to process request." });
    }
  });

  /**
   * POST /api/auth/reset-password
   * Accepts token and new password, validates token, updates password.
   */
  router.post("/reset-password", async (req: Request, res: Response) => {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    try {
      const db = getDb();

      const [resetToken] = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            eq(passwordResetTokens.used, false),
            gte(passwordResetTokens.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset token." });
      }

      const passwordHash = hashPassword(newPassword);

      await db.update(users).set({ passwordHash }).where(eq(users.id, resetToken.userId));
      await db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, resetToken.id));

      return res.json({ success: true, message: "Password has been reset successfully." });
    } catch (err) {
      console.error("Reset password error:", err);
      return res.status(500).json({ message: "Failed to reset password." });
    }
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

/**
 * Express middleware that blocks requests from users whose email
 * has not been verified.
 */
export function requireVerified(req: Request, res: Response, next: NextFunction) {
  if (req.session?.user?.emailVerified) {
    return next();
  }
  return res.status(403).json({ message: "Email verification required." });
}

/**
 * Express middleware that restricts access to admin users only.
 * Must be used after requireAuth to ensure the session exists.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session?.user?.role === "ADMIN") {
    return next();
  }
  return res.status(403).json({ message: "Admin access required." });
}
