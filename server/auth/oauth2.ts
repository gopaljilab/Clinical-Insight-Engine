import passport from "passport";
import { Strategy as OAuth2Strategy } from "passport-oauth2";

const OAUTH2_AUTH_URL = process.env.OAUTH2_AUTH_URL;
const OAUTH2_TOKEN_URL = process.env.OAUTH2_TOKEN_URL;
const OAUTH2_CLIENT_ID = process.env.OAUTH2_CLIENT_ID;
const OAUTH2_CLIENT_SECRET = process.env.OAUTH2_CLIENT_SECRET;
const OAUTH2_CALLBACK_URL = process.env.OAUTH2_CALLBACK_URL;

if (
  OAUTH2_AUTH_URL &&
  OAUTH2_TOKEN_URL &&
  OAUTH2_CLIENT_ID &&
  OAUTH2_CLIENT_SECRET &&
  OAUTH2_CALLBACK_URL
) {
  passport.use(
    new OAuth2Strategy(
      {
        authorizationURL: OAUTH2_AUTH_URL,
        tokenURL: OAUTH2_TOKEN_URL,
        clientID: OAUTH2_CLIENT_ID,
        clientSecret: OAUTH2_CLIENT_SECRET,
        callbackURL: OAUTH2_CALLBACK_URL,
      },
      (_accessToken: string, _refreshToken: string, _profile: any, cb: unknown) => {
        // OAuth2 user lookup is not yet implemented.
        // Do NOT replace this with a hardcoded identity — every OAuth2 user would
        // share the same account and see all other users' patient records.
        // Implement a real DB lookup (e.g. by profile.emails[0].value) before enabling.
        return cb(new Error("OAuth2 authentication is not yet configured for this application."));
import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { getDb } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = process.env.APP_URL || "http://localhost:5173";

/**
 * Generates a cryptographically random state string for CSRF protection.
 */
function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Exchanges an authorization code for access and ID tokens from Google.
 */
async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: GOOGLE_CLIENT_ID!,
    client_secret: GOOGLE_CLIENT_SECRET!,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} — ${text}`);
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    id_token?: string;
    expires_in: number;
    token_type: string;
  }>;
}

/**
 * Fetches the user's Google profile using the access token.
 */
async function fetchGoogleUserProfile(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Profile fetch failed: ${response.status} — ${text}`);
  }

  return response.json() as Promise<{
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    picture?: string;
  }>;
}

/**
 * Creates or updates a local user record based on Google profile data.
 * Returns the user object suitable for session establishment.
 */
async function upsertLocalUser(profile: {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
}) {
  const db = getDb();
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);

  if (existingUser) {
    return existingUser;
  }

  // Generate a random placeholder for medical license and password hash.
  // These are required by the schema but irrelevant for OAuth-only users.
  const randomPassword = crypto.randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(randomPassword, 12);
  const placeholderLicense = `OAUTH-PLACEHOLDER-${crypto.randomUUID()}`;

  const [newUser] = await db
    .insert(users)
    .values({
      fullName: profile.name,
      email: profile.email,
      medicalLicenseNumber: placeholderLicense,
      passwordHash,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      role: "provider",
    })
    .returning();

  return newUser;
}

/**
 * Creates an Express router for Google OAuth2 authentication.
 */
export function createOAuth2Router(): Router {
  const router = Router();

  // If credentials aren't configured, the route returns a 503 so the
  // frontend can show a disabled state.
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    router.use("/google", (_req: Request, res: Response) => {
      res.status(503).json({
        error: "Google OAuth is not configured on this server.",
      });
    });
    return router;
  }

  /**
   * GET /api/auth/oauth2/google
   * Redirects the user to the Google consent screen.
   */
  router.get("/google", (req: Request, res: Response) => {
    const state = generateState();
    req.session.oauthState = {
      value: state,
      createdAt: Date.now(),
    };

    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/oauth2/google/callback`;

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
    });

    res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  /**
   * GET /api/auth/oauth2/google/callback
   * Validates the state param, exchanges code for tokens, upserts the user,
   * establishes a session, records the login audit, and redirects to the app.
   */
  router.get("/google/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query;

    // State CSRF validation
    const storedState = req.session?.oauthState;
    if (!storedState || storedState.value !== (state as string)) {
      return res
        .status(403)
        .json({ message: "Invalid or missing OAuth state parameter." });
    }
    // Clean up state after single use
    delete req.session.oauthState;
    // Validate state TTL (10 minutes)
    if (Date.now() - storedState.createdAt > 10 * 60 * 1000) {
      return res.status(403).json({ message: "OAuth state has expired." });
    }

    if (!code || typeof code !== "string") {
      return res
        .status(400)
        .json({ message: "Missing authorization code from Google." });
    }

    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/oauth2/google/callback`;

    try {
      // 1. Exchange authorization code for tokens
      const tokenData = await exchangeCodeForTokens(code, redirectUri);
      const accessToken = tokenData.access_token;

      // 2. Fetch user profile from Google
      const profile = await fetchGoogleUserProfile(accessToken);

      if (!profile.verified_email) {
        return res.status(403).json({
          message: "Google email is not verified.",
        });
      }

      // 3. Find or create local user
      const user = await upsertLocalUser(profile);

      // 4. Establish session
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to establish session." });
        }

        req.session.user = {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role ?? "provider",
          emailVerified: user.emailVerified ?? false,
        };

        req.session.save((saveErr) => {
          if (saveErr) {
            return res.status(500).json({ message: "Failed to save session." });
          }

          // Record login audit (best-effort)
          try {
            import("../storage").then(({ storage }) => {
              storage.recordLoginAudit({
                userId: user.id,
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"],
                loginStatus: "oauth_google",
              });
            });
          } catch (_auditErr) {
            // Non-fatal
          }

          res.redirect(APP_URL);
        });
      });
    } catch (err: any) {
      console.error("OAuth callback error:", err);
      res.status(500).json({
        message: "OAuth2 authentication failed. Please try again.",
      });
    }
  });

  return router;
}
