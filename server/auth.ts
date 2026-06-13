import { Router, type Request, type Response, type NextFunction } from "express";
import { randomInt, randomBytes } from "crypto";
import bcrypt from "bcrypt";
import { rateLimit } from "express-rate-limit";
import { eq, and, gte, sql } from "drizzle-orm";
import { issueToken } from "./services/auth/tokenValidator";
import { storage } from "./storage";
import { getDb } from "./db";
import { users, emailVerificationTokens, passwordResetTokens } from "@shared/schema";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";
import { logger } from "./logger";
import { validateDTO } from "./middleware/validateDTO";
import { registerDTOSchema, loginDTOSchema, forgotPasswordDTOSchema, resetPasswordDTOSchema, verifyEmailDTOSchema, verifyOtpDTOSchema } from "./validation/auth.dto";

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password: string, storedHash: string): boolean {
  return bcrypt.compareSync(password, storedHash);
}
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
    pendingUser?: {
      id: string;
      email: string;
    };
  }
}

interface RegisteredUser {
  fullName: string;
  email: string;
  passwordHash: string;
  licenseNumber: string;
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
 * Strict rate limiter for standard auth endpoints (e.g., login).
 * Prevents brute-force attacks and credential stuffing (Fixes #996).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
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

export const pendingOtps = new Map<string, { otp: string; expiresAt: number; attempts: number }>();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}


// NOTE: there must be exactly one getOtpRateLimitKey export in this module.




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
/**
 * Normalised identity returned by getAuthenticatedUser().
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: string;
  isActive: boolean;
  authMethod: "session" | "jwt";
}

/**
 * Unified identity resolver that accepts either a session cookie or a
 * JWT bearer token and returns a normalised AuthenticatedUser after
 * checking the account's isActive flag in the database.
 */
export async function getAuthenticatedUser(
  req: Request,
): Promise<AuthenticatedUser | null> {
  if (req.session?.user) {
    const sessionUser = req.session.user;
    const dbUser = await storage.getUserById(sessionUser.id);
    if (!dbUser || dbUser.isActive === false) {
      return null;
    }
    return {
      userId: dbUser.id,
      email: dbUser.email,
      role: dbUser.role ?? "provider",
      isActive: dbUser.isActive ?? true,
      authMethod: "session",
    };
  }

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      const token = parts[1];
      if (token && token.includes(".")) {
        const { verifyToken } = await import("./services/auth/tokenValidator");
        const result = verifyToken(token);
        if (result.valid) {
          const email = result.payload.email;
          if (email) {
            const dbUser = await storage.getUserByEmail(email);
            if (dbUser && dbUser.isActive !== false) {
              return {
                userId: dbUser.id,
                email: dbUser.email,
                role: dbUser.role ?? "provider",
                isActive: dbUser.isActive ?? true,
                authMethod: "jwt",
              };
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Unified middleware that enforces authentication via session OR JWT,
 * normalises identity, and checks account active status.
 */
export async function requireAnyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return res.status(401).json({ message: "Authentication required." });
    }
    (req as any).authenticatedUser = authUser;
    next();
  } catch {
    return res.status(500).json({ message: "Authentication check failed." });
  }
}

export function createAuthRouter(): Router {
  const router = Router();

  /**
   * POST /api/auth/register
   * Validates registration fields, creates a new user account, and establishes a pending session.
   */
  router.post("/register", strictAuthLimiter, validateDTO(registerDTOSchema), async (req: Request, res: Response) => {
    const { fullName, email, password, licenseNumber } = req.body;

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
      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      let registeredUserId: string;

      await db.transaction(async (tx) => {
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

        registeredUserId = newUser.id;

        await tx.insert(emailVerificationTokens).values({
          userId: newUser.id,
          verificationCode: otp,
          expiresAt,
          used: false,
          attemptCount: 0,
        });
      });

      const emailSent = await sendVerificationEmail(email, otp);
      if (!emailSent) {
        return res.status(503).json({ message: "Failed to send verification email. Please try again." });
      }

      logDevOtp(email, otp);

      await storage.recordLoginAudit({
        userId: registeredUserId!,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        loginStatus: "registration",
      });

      // Create a pending session
      await regenerateSession(req);
      req.session.pendingUser = { id: registeredUserId!, email };
      await saveSession(req);

      return res.status(201).json({ success: true, pendingEmail: email });
    } catch (err) {
      logger.error({ err }, "Registration error");
      return res.status(500).json({ message: "Registration failed due to a server error." });
    }
  });

  /**
   * POST /api/auth/login
   * Validates email/password against DB and creates a pending session.
   */
  router.post("/login", authLimiter, validateDTO(loginDTOSchema), async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
      const db = getDb();
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!dbUser || !dbUser.isActive) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      const passwordOk = verifyPassword(password, dbUser.passwordHash);
      if (!passwordOk) {
        return res.status(401).json({ message: "Invalid credentials." });
      }

      const otp = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await db.transaction(async (tx) => {
        // Invalidate old unused tokens for this user
        await tx
          .update(emailVerificationTokens)
          .set({ used: true })
          .where(
            and(
              eq(emailVerificationTokens.userId, dbUser.id),
              eq(emailVerificationTokens.used, false),
            ),
          );

        await tx.insert(emailVerificationTokens).values({
          userId: dbUser.id,
          verificationCode: otp,
          expiresAt,
          used: false,
          attemptCount: 0,
        });
      });

      const emailSent = await sendVerificationEmail(email, otp);
      if (!emailSent) {
        return res.status(503).json({ message: "Failed to send verification email. Please try again." });
      }

      logDevOtp(email, otp);

      await regenerateSession(req);
      req.session.pendingUser = { id: dbUser.id, email: dbUser.email };
      await saveSession(req);

      return res.json({ success: true, pendingEmail: email });
    } catch (err) {
      logger.error({ err }, "Login error");
      return res.status(500).json({ message: "Login failed due to a server error." });
    }
  });


  /**
   * POST /api/auth/resend-otp
   * Resends a verification code for an already-started login or registration flow using DB tokens.
   */
  router.post("/resend-otp", resendLimiter, async (req: Request, res: Response) => {
    const email = (req.body?.email ?? "").trim().toLowerCase();
    const mode = req.body?.mode;

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
        const emailSent = await sendVerificationEmail(email, otp);
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

      // We no longer block resend if user is verified, they might be logging in.
      
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

      const emailSent = await sendVerificationEmail(email, otp);
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
  router.post("/verify-otp", verifyEmailLimiter, validateDTO(verifyOtpDTOSchema), async (req: Request, res: Response) => {
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

    const devEmail = process.env.DEV_CLINICIAN_EMAIL || "";

    let id: string;
    let name: string;
    let role: string;

    let emailVerified = false;

    if (email === devEmail) {
      name = "Dr. Smith";
      id = "dev";
      role = "DOCTOR";
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
      if (!user.isActive) {
        return res.status(403).json({ message: "Account has been deactivated." });
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
  });

  // ─── Email Verification (DB-backed) ────────────────────────────────────

  /**
   * POST /api/auth/verify-email
   * Validates a 6-digit OTP against the email_verification_tokens table.
   * On success, marks the user as verified and establishes an authenticated session.
   */
  router.post("/verify-email", verifyEmailLimiter, validateDTO(verifyEmailDTOSchema), async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;

      // Verify the session actually belongs to this email if they have a pending session
      // (This adds an extra layer of security so attackers can't verify other people's emails easily)
      if (req.session.pendingUser && req.session.pendingUser.email !== email) {
         return res.status(403).json({ message: "Session mismatch. Please log in again." });
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

      type VerifyOutcome =
        | { success: true }
        | { success: false; status: number; message: string };

      const outcome: VerifyOutcome = await db.transaction(async (tx) => {
        const [token] = await tx
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
          return { success: false as const, status: 400, message: "No valid verification code found. Please request a new code." };
        }

        const maxAttempts = 3;
        if ((token.attemptCount ?? 0) >= maxAttempts) {
          await tx
            .update(emailVerificationTokens)
            .set({ used: true })
            .where(eq(emailVerificationTokens.id, token.id));

          return { success: false as const, status: 429, message: "Too many failed attempts. Please request a new verification code." };
        }

        if (token.verificationCode !== code) {
          const newAttemptCount = (token.attemptCount ?? 0) + 1;

          if (newAttemptCount >= maxAttempts) {
            await tx
              .update(emailVerificationTokens)
              .set({ used: true })
              .where(eq(emailVerificationTokens.id, token.id));

            return {
              success: false as const,
              status: 429,
              message: "Too many failed attempts. Please request a new verification code.",
            };
          }

          await tx
            .update(emailVerificationTokens)
            .set({ attemptCount: newAttemptCount })
            .where(and(
              eq(emailVerificationTokens.id, token.id),
              eq(emailVerificationTokens.used, false),
            ));

          const remaining = maxAttempts - newAttemptCount;
          return {
            success: false as const,
            status: 401,
            message: `Invalid code. ${remaining} attempt(s) remaining.`,
          };
        }

        const [claimed] = await tx
          .update(emailVerificationTokens)
          .set({ used: true })
          .where(and(
            eq(emailVerificationTokens.id, token.id),
            eq(emailVerificationTokens.used, false),
          ))
          .returning();

        if (!claimed) {
          return { success: false as const, status: 409, message: "This code has already been used." };
        }

        if (!user.emailVerified) {
          await tx
            .update(users)
            .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
            .where(eq(users.id, user.id));
        }

        return { success: true as const };
      });

      if (!outcome.success) {
        return res.status(outcome.status).json({ message: outcome.message });
      }

      // Upgrade session to fully authenticated
      delete req.session.pendingUser;
      await establishAuthenticatedSession(req, { 
        id: user.id, 
        email: user.email, 
        name: user.fullName, 
        role: user.role ?? "PATIENT", 
        emailVerified: true 
      });

      await storage.recordLoginAudit({
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        loginStatus: "email_verified",
      });

      return res.json({ success: true, message: "Email verified successfully.", user: { id: user.id, email: user.email, name: user.fullName } });
    } catch (err) {
      logger.error({ err }, "Email verification error");
      return res.status(500).json({ message: "Verification failed due to a server error." });
    }
  });

  /**
   * POST /api/auth/logout
out
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
        // Always return 200 regardless of whether the email exists — returning
        // 404 leaks user account existence and enables email enumeration attacks.
        return res.status(200).json({ success: true, message: "If an account exists with this email, a reset link has been sent." });
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

  /**
   * GET /api/auth/token
   * Issues a JWT for an authenticated, verified user.
   * Used by clients that require a bearer token for API access.
   */
  router.get("/token", requireAuth, requireVerified, (req, res) => {
    const user = req.session.user as any;

    if (!user?.id || !user?.email) {
      return res.status(401).json({ message: "Invalid session user data" });
    }

    const token = issueToken(user.id, user.email, "provider");
    res.json({ token });
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



