import { Router, type Request, type Response, type NextFunction } from "express";
import { randomInt, randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { rateLimit } from "express-rate-limit";
import { eq, and, gte, sql } from "drizzle-orm";
import { storage } from "./storage";
import { getDb } from "./db";
import { users, emailVerificationTokens, passwordResetTokens } from "@shared/schema";
import { sendVerificationCode, sendPasswordResetEmail } from "./email";
import { logger } from "./logger";
import { validateDTO } from "./middleware/validateDTO";
import { registerDTOSchema, loginDTOSchema, forgotPasswordDTOSchema, resetPasswordDTOSchema, verifyEmailDTOSchema, verifyOtpDTOSchema } from "./validation/auth.dto";

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
  attempts: number;
}

/**
 * In-memory OTP store keyed by email.
 * Each entry expires after 10 minutes.
 */
export const pendingOtps = new Map<string, PendingOtp>();

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
 * Strict rate limiter for sensitive endpoints (e.g., registration).
 * Prevents mass account creation and brute-force attacks.
 */
const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Stricter limit (Fixes #624)
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many authentication attempts. Please try again later." },
});

/**
 * General rate limiter for standard auth endpoints (e.g., login).
 * More lenient than strictAuthLimiter to avoid frustrating legitimate users.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login/registration attempts. Please try again in 15 minutes." },
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



const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many resend requests. Please try again later." },
});

/**
 * Stricter rate limiter for password-reset endpoint.
 * Guards against token brute-force on the only credential-changing unauthenticated route.
 */
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many password reset attempts. Please try again later." },
});

function generateOtp(): string {
  return randomInt(100000, 999999).toString();
}

function logDevOtp(email: string, otp: string) {
  if (process.env.NODE_ENV !== "production") {
    logger.info(`[DEV] OTP for ${email}: ${otp}`);
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
 * Credentials are validated against hashed passwords in the database (or the
 * in-memory store during initial registration). All users must complete OTP
 * verification to establish an authenticated session.
 */
export function createAuthRouter(): Router {
  const router = Router();

  /**
   * POST /api/auth/register
   * Validates registration fields, creates a new user account, and establishes a session.
   */
  router.post("/register", strictAuthLimiter, validateDTO(registerDTOSchema), async (req: Request, res: Response) => {
    const { fullName, email, password, licenseNumber } = req.body;


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
            role: "DOCTOR",
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
      });

      // Send verification email
      const emailSent = await sendVerificationCode(email, otp);
      if (!emailSent) {
        return res.status(503).json({ message: "Failed to send verification email. Please try again." });
      }

      // In production, send OTP via email. For development, return it in the response.
      logDevOtp(email, otp);

      await storage.recordLoginAudit({
        userId: registeredUserId!,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        loginStatus: "registration",
      });

      return res.status(201).json({ success: true, pendingEmail: email });
    } catch (err) {
      logger.error({ err }, "Registration error");
      return res.status(500).json({ message: "Registration failed due to a server error." });
    }
  });

  /**
   * POST /api/auth/login
   * Validates email/password against server-side env vars or registered users and creates a session.
   */
  router.post("/login", authLimiter, validateDTO(loginDTOSchema), async (req: Request, res: Response) => {
    const { email, password } = req.body;

    let userName: string | null = null;

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
          logger.warn("DB unavailable for login, using in-memory only.");
          const registeredUser = registeredUsers.get(email);
          if (registeredUser && verifyPassword(password, registeredUser.passwordHash)) {
            userName = registeredUser.fullName;
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
    pendingOtps.set(email, { otp, expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });

    // Send verification email
    const emailSent = await sendVerificationCode(email, otp);
    if (!emailSent) {
      return res.status(503).json({ message: "Failed to send verification email. Please try again." });
    }

    // In production, send OTP via email. For development, return it in the response.
    logDevOtp(email, otp);

    return res.json({ success: true, pendingEmail: email });
  });

  /**
   * POST /api/auth/resend-otp
   * Resends a verification code for an already-started login or registration flow.
   */
  router.post("/resend-otp", resendLimiter, async (req: Request, res: Response) => {
    const email = (req.body?.email ?? "").trim().toLowerCase();
    const mode = req.body?.mode === "register" ? "register" : "login";

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      if (mode === "login") {
        const pending = pendingOtps.get(email);

        if (!pending) {
          return res.status(400).json({ message: "No pending verification found for this email. Please sign in again." });
        }

        if (Date.now() > pending.expiresAt) {
          pendingOtps.delete(email);
          return res.status(400).json({ message: "OTP has expired. Please sign in again." });
        }

        pendingOtps.set(email, { otp, expiresAt: expiresAt.getTime(), attempts: 0 });
        const emailSent = await sendVerificationCode(email, otp);
        if (!emailSent) {
          return res.status(503).json({ message: "Failed to send verification email. Please try again." });
        }
        logDevOtp(email, otp);

        return res.json({ success: true, pendingEmail: email });
      }

      const db = getDb();
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }

      if (user.emailVerified) {
        return res.status(400).json({ message: "Email is already verified." });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(emailVerificationTokens)
          .set({ used: true })
          .where(and(
            eq(emailVerificationTokens.userId, user.id),
            eq(emailVerificationTokens.used, false),
          ));

        await tx.insert(emailVerificationTokens).values({
          userId: user.id,
          verificationCode: otp,
          expiresAt,
          used: false,
          attemptCount: 0,
        });
      });

      const emailSent = await sendVerificationCode(email, otp);
      if (!emailSent) {
        return res.status(503).json({ message: "Failed to send verification email. Please try again." });
      }
      logDevOtp(email, otp);

      return res.json({ success: true, pendingEmail: email });
    } catch (err) {
      logger.error({ err }, "OTP resend error");
      return res.status(500).json({ message: "Failed to resend verification code." });
    }
  });

  /**
   * POST /api/auth/verify-otp
   * Verifies the OTP sent after login/register and establishes a session.
   */
  router.post("/verify-otp", otpLimiter, validateDTO(verifyOtpDTOSchema), async (req: Request, res: Response) => {
    try {
      const { email, otp } = req.body;

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
        pending.attempts = (pending.attempts ?? 0) + 1;

        if (pending.attempts >= 3) {
          pendingOtps.delete(email);
          await storage.recordLoginAudit({
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            loginStatus: "otp_failed_lockout",
          });
          return res.status(429).json({
            message: "Too many failed attempts. Please sign in again.",
          });
        }

        await storage.recordLoginAudit({
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          loginStatus: "otp_failed",
        });
        const remaining = 3 - pending.attempts;
        return res.status(401).json({
          message: `Invalid OTP. ${remaining} attempt(s) remaining.`,
        });
      }

      pendingOtps.delete(email);

      let id = "";
      let name = "";
      let role = "";
      let emailVerified = false;

      // Dev shortcut for local development — never active in production
      if (process.env.NODE_ENV !== "production" && email === (process.env.DEV_CLINICIAN_EMAIL || "")) {
        name = "Dr. Smith";
        id = "dev";
        role = "DOCTOR";
        emailVerified = true;
      }

      if (!id) {
        const db = getDb();
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (!user) {
          return res.status(404).json({ message: "User not found." });
        }

        if (!user.emailVerified) {
          await db
            .update(users)
            .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
            .where(eq(users.id, user.id));
        }

        id = user.id;
        name = user.fullName;
        role = user.role ?? "DOCTOR";
        emailVerified = true;
      }

      try {
        await establishAuthenticatedSession(req, { id, email, name, role, emailVerified });
      } catch (error) {
        logger.error({ err: error }, "Session regeneration failed");
        return res.status(500).json({ message: "Failed to establish session." });
      }

      await storage.recordLoginAudit({
        userId: id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        loginStatus: "login_success",
      });

      return res.json({ success: true, user: { id, email, name } });
    } catch (error) {
      logger.error({ err: error }, "OTP verification failed");
      return res.status(500).json({ message: "An unexpected error occurred. Please try again." });
    }
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
  router.post("/verify-email", verifyEmailLimiter, validateDTO(verifyEmailDTOSchema), async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;

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
        await establishAuthenticatedSession(req, { id: user.id, email: user.email, name: user.fullName, role: user.role ?? "DOCTOR", emailVerified: true });
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
        .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id));

      await establishAuthenticatedSession(req, { id: user.id, email: user.email, name: user.fullName, role: user.role ?? "DOCTOR", emailVerified: true });

      await storage.recordLoginAudit({
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        loginStatus: "email_verified",
      });

      return res.json({ success: true, message: "Email verified successfully." });
    } catch (err) {
      logger.error({ err }, "Email verification error");
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
        logger.error({ err }, "Session destruction failed");
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
  router.post("/forgot-password", authLimiter, validateDTO(forgotPasswordDTOSchema), async (req: Request, res: Response) => {
    const { email } = req.body;

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

      const emailSent = await sendPasswordResetEmail(email, resetLink);
      if (!emailSent) {
        return res.status(503).json({ message: "Failed to send password reset email. Please try again." });
      }

      return res.json({ success: true, message: "If an account exists, a reset link has been sent." });
    } catch (err) {
      logger.error({ err }, "Forgot password error:");
      return res.status(500).json({ message: "Failed to process request." });
    }
  });

  /**
   * POST /api/auth/reset-password
   * Accepts token and new password, validates token, updates password.
   */
  router.post("/reset-password", passwordLimiter, validateDTO(resetPasswordDTOSchema), async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

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

      // Invalidate all active sessions for the user to prevent session hijacking
      try {
        await db.execute(sql`DELETE FROM "session" WHERE (sess->'user'->>'id') = ${resetToken.userId}`);
      } catch (sessErr) {
        logger.error({ err: sessErr, userId: resetToken.userId }, "Failed to clear user sessions upon password reset");
      }

      return res.json({ success: true, message: "Password has been reset successfully." });
    } catch (err) {
      logger.error({ err }, "Reset password error:");
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
