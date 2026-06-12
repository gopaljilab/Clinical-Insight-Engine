/**
 * jwtVerification.ts
 *
 * Express middleware that enforces strict JWT authentication for protected routes.
 *
 * Authentication flow:
 *   Request
 *     ↓ Extract "Authorization: Bearer <token>"
 *     ↓ Missing token → 401 { message: "Unauthorized" }
 *     ↓ verifyToken() — strict HS256, no alg=none, signature verified
 *     ↓ Verification failure (any reason) → 401 { message: "Unauthorized" }
 *     ↓ Attach verified payload to req.jwtUser
 *     ↓ next()
 *
 * Security principles:
 * - All 401 responses are identical — no hint of which check failed
 * - Token contents are NEVER logged (no PHI, no credentials)
 * - User identity for the request comes exclusively from the verified payload
 * - No fallback to unauthenticated access
 */

import type { Request, Response, NextFunction } from "express";
import { verifyToken, type VerifiedTokenPayload } from "../services/auth/tokenValidator";
import { logSecurityEvent } from "../security/sqlProtection";

// Extend Express Request type to carry the verified JWT payload
declare global {
  namespace Express {
    interface Request {
      jwtUser?: VerifiedTokenPayload;
    }
  }
}

/**
 * Extracts the raw token string from the Authorization header.
 * Returns null if the header is missing or malformed.
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Must be exactly: "Bearer <token>"
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  const token = parts[1];
  // Basic sanity check — a JWT always has two dots
  if (!token || !token.includes(".")) {
    return null;
  }

  return token;
}

/**
 * requireJwtAuth
 *
 * Middleware that verifies a Bearer JWT on every request.
 * On success, attaches verified payload to req.jwtUser and calls next().
 * On any failure, returns 401 { message: "Unauthorized" } immediately.
 *
 * Never exposes verification failure details to the client.
 */
export function requireJwtAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);

  if (!token) {
    logSecurityEvent(
      "UNAUTHORIZED_SEARCH_ACCESS",
      "JWT required but Authorization header is missing or malformed",
      req
    );
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const result = verifyToken(token);

  if (!result.valid) {
    // Log the failure type internally (no token content, no PHI)
    const eventType = result.reason === "alg_not_allowed"
      ? "SQL_INJECTION_ATTEMPT"   // Reuse closest available type for alg=none attempts
      : "UNAUTHORIZED_SEARCH_ACCESS";

    logSecurityEvent(
      eventType,
      `JWT verification failed: ${result.reason}`,
      req,
      { userId: undefined } // Do not log claimed user ID from an unverified token
    );

    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  // Attach the verified payload — routes use this as the authoritative identity
  req.jwtUser = result.payload;

  next();
}
