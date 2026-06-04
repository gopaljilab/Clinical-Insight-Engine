/**
 * tokenValidator.ts
 *
 * JWT token verification service.
 *
 * Security design:
 * ─────────────────────────────────────────────────────────────────────────
 * PRIMARY FIX for alg=none attacks:
 *   jwt.verify(token, secret, { algorithms: ["HS256"] })
 *
 * Passing an explicit algorithms allowlist forces the jsonwebtoken library to
 * REJECT any token whose header specifies a different algorithm — including
 * alg=none — BEFORE signature verification even runs. This is the standard
 * recommended fix (CVE-2015-9235 and related).
 *
 * NEVER use jwt.decode() for authentication decisions. decode() skips
 * signature verification entirely and must only be used after a successful
 * verify() call, if needed for logging (and even then, never log PHI).
 * ─────────────────────────────────────────────────────────────────────────
 */

import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

/** Algorithms explicitly allowed. Any other value — including "none" — is rejected. */
const ALLOWED_ALGORITHMS: jwt.Algorithm[] = ["HS256"];

/** Minimum secret length in production to prevent weak-secret attacks. */
const MIN_SECRET_LENGTH = 32;

export interface VerifiedTokenPayload extends JwtPayload {
  /** User ID (subject claim). */
  sub: string;
  /** User email. */
  email: string;
  /** User role. */
  role?: string;
}

/** Returned when verification succeeds. */
export type VerifySuccess = {
  valid: true;
  payload: VerifiedTokenPayload;
};

/** Returned when verification fails — reason is for internal logging only, never sent to clients. */
export type VerifyFailure = {
  valid: false;
  /** Internal reason — NEVER send this to API clients. */
  reason: "expired" | "invalid_signature" | "alg_not_allowed" | "malformed" | "missing_claims";
};

export type VerifyResult = VerifySuccess | VerifyFailure;

/**
 * Returns the JWT signing secret from the environment.
 * Throws at startup if the secret is missing or too short in production.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is required in production.");
    }
    // Development fallback — weak and obvious so it is never mistaken for production
    console.warn(
      "[SECURITY WARNING] JWT_SECRET is not set. Using insecure development default. " +
      "Set JWT_SECRET in your .env file before deploying."
    );
    return "clinical-insight-engine-insecure-dev-jwt-secret-change-me";
  }

  if (process.env.NODE_ENV === "production" && secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters in production.`
    );
  }

  return secret;
}

/**
 * Verifies a JWT token with strict algorithm enforcement.
 *
 * Security guarantees:
 * - Signature is always verified (uses jwt.verify, not jwt.decode)
 * - Only HS256 is accepted — alg=none and all other algorithms are rejected
 * - Token expiry (exp), issued-at (iat) claims are validated by the library
 * - Required claims (sub, email) are validated after library verification
 *
 * @param token  Raw JWT string (without "Bearer " prefix)
 * @returns      VerifyResult — success with typed payload, or failure with internal reason
 */
export function verifyToken(token: string): VerifyResult {
  const secret = getJwtSecret();

  let decoded: jwt.JwtPayload | string;

  try {
    // PRIMARY SECURITY CONTROL:
    // The algorithms option is what prevents alg=none bypass.
    // If the token header contains ANY algorithm not in this list, verify() throws.
    decoded = jwt.verify(token, secret, {
      algorithms: ALLOWED_ALGORITHMS,
      complete: false,
    });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { valid: false, reason: "expired" };
    }

    if (err instanceof jwt.JsonWebTokenError) {
      // JsonWebTokenError covers: invalid signature, alg=none, malformed tokens
      // Check if it's specifically an algorithm rejection
      if (err.message.includes("invalid algorithm") || err.message.includes("alg") || err.message.includes("jwt signature is required")) {
        return { valid: false, reason: "alg_not_allowed" };
      }
      return { valid: false, reason: "invalid_signature" };
    }

    if (err instanceof jwt.NotBeforeError) {
      return { valid: false, reason: "invalid_signature" };
    }

    return { valid: false, reason: "malformed" };
  }

  // Ensure decoded is an object (not a string — which happens for non-standard tokens)
  if (typeof decoded !== "object" || decoded === null) {
    return { valid: false, reason: "malformed" };
  }

  // Validate required claims are present
  if (!decoded.sub || typeof decoded.sub !== "string") {
    return { valid: false, reason: "missing_claims" };
  }
  if (!decoded.email || typeof decoded.email !== "string") {
    return { valid: false, reason: "missing_claims" };
  }

  return {
    valid: true,
    payload: decoded as VerifiedTokenPayload,
  };
}

/**
 * Issues a signed JWT for a verified user.
 *
 * Algorithm is hardcoded to HS256 — never read from request or user input.
 *
 * @param userId    User's database ID (becomes the sub claim)
 * @param email     User's email address
 * @param role      User's role (default: "provider")
 * @param expiresIn Token lifetime (default: env JWT_EXPIRES_IN or "1h")
 */
export function issueToken(
  userId: string,
  email: string,
  role: string = "provider",
  expiresIn?: string
): string {
  const secret = getJwtSecret();
  const expiry = (expiresIn ?? process.env.JWT_EXPIRES_IN ?? "1h") as SignOptions["expiresIn"];

  // Use payload.sub instead of SignOptions.subject (typings vary by jsonwebtoken version)
  return jwt.sign(
    { sub: userId, email, role },
    secret,
    {
      subject: userId,
      // Algorithm is hardcoded — never sourced from user input or configuration
      algorithm: "HS256",
      expiresIn: expiry,
    } as jwt.SignOptions
  );
}
