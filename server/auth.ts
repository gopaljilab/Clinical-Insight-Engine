import { Router, type Request, type Response, type NextFunction } from "express";

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

    req.session.user = {
      email,
      name: fullName,
    };

    return res.status(201).json({
      success: true,
      user: { email, name: fullName },
    });
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

    if (email === devEmail && password === devPassword) {
      req.session.user = {
        email,
        name: "Dr. Smith",
      };

      return res.json({
        success: true,
        user: { email, name: "Dr. Smith" },
      });
    }

    const registeredUser = registeredUsers.get(email);
    if (registeredUser && registeredUser.password === password) {
      req.session.user = {
        email,
        name: registeredUser.fullName,
      };

      return res.json({
        success: true,
        user: { email, name: registeredUser.fullName },
      });
    }

    return res.status(401).json({ message: "Invalid email or password." });
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
