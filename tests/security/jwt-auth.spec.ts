/**
 * jwt-auth.spec.ts
 *
 * Security tests for JWT authentication bypass vulnerability (Issue #438).
 * Ensures that the system strictly validates JWT signatures and algorithms,
 * rejecting alg=none attacks and tampered payloads.
 */

import { describe, expect, it, beforeAll } from "vitest";
import jwt from "jsonwebtoken";
import { verifyToken, issueToken, getJwtSecret } from "../../server/services/auth/tokenValidator";
import type { Request, Response, NextFunction } from "express";
import { requireJwtAuth } from "../../server/middleware/jwtVerification";

describe("JWT Token Validator", () => {
  const secret = getJwtSecret();
  const validPayload = { sub: "user-123", email: "test@example.com" };

  it("Scenario 1: Accepts a valid, correctly signed JWT", () => {
    const token = issueToken("user-123", "test@example.com");
    const result = verifyToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.sub).toBe("user-123");
      expect(result.payload.email).toBe("test@example.com");
    }
  });

  it("Scenario 2: Rejects an alg=none token", () => {
    // Manually construct an alg=none token
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify(validPayload)).toString("base64url");
    const token = `${header}.${payload}.`;

    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("alg_not_allowed");
    }
  });

  it("Scenario 3: Rejects a modified payload (signature mismatch)", () => {
    const validToken = issueToken("user-123", "test@example.com");
    const parts = validToken.split(".");
    
    // Modify payload to elevate privileges
    const maliciousPayload = { sub: "admin-1", email: "admin@example.com" };
    const modifiedPayloadB64 = Buffer.from(JSON.stringify(maliciousPayload)).toString("base64url");
    
    // Assemble tampered token with original signature
    const tamperedToken = `${parts[0]}.${modifiedPayloadB64}.${parts[2]}`;

    const result = verifyToken(tamperedToken);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid_signature");
    }
  });

  it("Scenario 4: Rejects a token with an invalid signature", () => {
    // Sign with wrong secret
    const token = jwt.sign(validPayload, "wrong-secret", { algorithm: "HS256" });
    const result = verifyToken(token);
    
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid_signature");
    }
  });

  it("Scenario 5: Rejects an expired token", () => {
    // Sign token with -1s expiration
    const token = jwt.sign(validPayload, secret, { algorithm: "HS256", expiresIn: "-1s" });
    const result = verifyToken(token);
    
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("expired");
    }
  });

  it("Rejects tokens missing required claims", () => {
    const token = jwt.sign({ customClaim: "yes" }, secret, { algorithm: "HS256" });
    const result = verifyToken(token);
    
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("missing_claims");
    }
  });
});

describe("JWT Middleware (requireJwtAuth)", () => {
  // Mock Express Request/Response
  const mockReq = (authHeader?: string) => ({
    headers: { authorization: authHeader }
  } as Request);
  
  const mockRes = () => {
    const res: any = {};
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data: any) => {
      res.body = data;
      return res;
    };
    return res as Response & { statusCode?: number, body?: any };
  };

  const mockNext = () => {
    let called = false;
    const next: NextFunction = () => { called = true; };
    return { next, wasCalled: () => called };
  };

  it("Scenario 6: Missing token returns 401 Unauthorized", () => {
    const req = mockReq(); // No auth header
    const res = mockRes();
    const { next, wasCalled } = mockNext();

    requireJwtAuth(req, res, next);

    expect(wasCalled()).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  it("Malformed Authorization header returns 401", () => {
    const req = mockReq("Token 12345"); // Not Bearer
    const res = mockRes();
    const { next, wasCalled } = mockNext();

    requireJwtAuth(req, res, next);

    expect(wasCalled()).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("Valid Bearer token calls next() and attaches user payload", () => {
    const token = issueToken("user-999", "provider@example.com");
    const req = mockReq(`Bearer ${token}`);
    const res = mockRes();
    const { next, wasCalled } = mockNext();

    requireJwtAuth(req, res, next);

    expect(wasCalled()).toBe(true);
    expect(req.jwtUser).toBeDefined();
    expect(req.jwtUser?.sub).toBe("user-999");
  });

  it("Invalid Bearer token returns 401 and does not expose error details", () => {
    const req = mockReq("Bearer invalid.token.here");
    const res = mockRes();
    const { next, wasCalled } = mockNext();

    requireJwtAuth(req, res, next);

    expect(wasCalled()).toBe(false);
    expect(res.statusCode).toBe(401);
    // Ensure we don't leak internals like "jwt malformed"
    expect(res.body).toEqual({ message: "Unauthorized" });
  });
});
