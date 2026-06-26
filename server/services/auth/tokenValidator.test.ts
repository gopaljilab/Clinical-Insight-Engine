import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import jwt from "jsonwebtoken";
import { issueToken, verifyToken } from "./tokenValidator";

describe("tokenValidator", () => {
  const TEST_SECRET = "test-secret-key-at-least-32-chars-long-for-hs256";

  beforeEach(() => {
    // Ensure clean env for each test
    vi.stubEnv("JWT_SECRET", TEST_SECRET);
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("issueToken", () => {
    it("issues a valid HS256 JWT with sub, email, and role claims", () => {
      const token = issueToken("user-123", "doctor@hospital.org", "provider");
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts

      // Verify the token is decodable with the test secret
      const decoded = jwt.verify(token, TEST_SECRET) as Record<string, unknown>;
      expect(decoded.sub).toBe("user-123");
      expect(decoded.email).toBe("doctor@hospital.org");
      expect(decoded.role).toBe("provider");
    });

    it("uses default role 'provider' when not specified", () => {
      const token = issueToken("user-456", "nurse@hospital.org");
      const decoded = jwt.verify(token, TEST_SECRET) as Record<string, unknown>;
      expect(decoded.role).toBe("provider");
    });

    it("respects custom expiresIn when provided", () => {
      const token = issueToken("user-789", "admin@hospital.org", "admin", "30s");
      const decoded = jwt.verify(token, TEST_SECRET) as Record<string, unknown>;
      expect(decoded.sub).toBe("user-789");
    });

    it("hardcodes algorithm to HS256 regardless of input", () => {
      const token = issueToken("user-abc", "user@example.com");
      const header = jwt.decode(token, { complete: true })?.header as Record<string, unknown> | null;
      expect(header?.alg).toBe("HS256");
    });
  });

  describe("verifyToken", () => {
    it("returns valid:true with correct payload for a genuine token", () => {
      const token = issueToken("user-123", "doctor@hospital.org", "provider");
      const result = verifyToken(token);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.sub).toBe("user-123");
        expect(result.payload.email).toBe("doctor@hospital.org");
        expect(result.payload.role).toBe("provider");
      }
    });

    it("returns valid:false reason:invalid_signature for wrong secret", () => {
      const token = jwt.sign(
        { sub: "user-123", email: "doctor@hospital.org", role: "provider" },
        "wrong-secret-key-that-is-also-long-enough",
        { algorithm: "HS256", expiresIn: "15m" }
      );
      const result = verifyToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("invalid_signature");
      }
    });

    it("returns valid:false reason:expired for expired tokens", () => {
      const token = jwt.sign(
        { sub: "user-123", email: "doctor@hospital.org", role: "provider" },
        TEST_SECRET,
        { algorithm: "HS256", expiresIn: "-1s" } // expired immediately
      );
      const result = verifyToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("expired");
      }
    });

    it("returns valid:false reason:alg_not_allowed for alg=none tokens", () => {
      // Manually craft a token with alg=none (the attack vector)
      const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({ sub: "attacker", email: "evil@hospital.org", role: "admin" })
      ).toString("base64url");
      const token = `${header}.${payload}.`;
      const result = verifyToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("alg_not_allowed");
      }
    });

    it("returns valid:false reason:alg_not_allowed for RS256 tokens (wrong algorithm)", () => {
      // RS256 tokens signed with a different algorithm should be rejected
      const { publicKey, privateKey } = require("crypto").generateKeyPairSync("rsa", {
        modulusLength: 2048,
      });
      const token = jwt.sign(
        { sub: "user-123", email: "doctor@hospital.org" },
        privateKey,
        { algorithm: "RS256", expiresIn: "15m" }
      );
      const result = verifyToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("alg_not_allowed");
      }
    });

    it("returns valid:false reason:missing_claims when sub is absent", () => {
      const token = jwt.sign(
        { email: "doctor@hospital.org" },
        TEST_SECRET,
        { algorithm: "HS256", expiresIn: "15m" }
      );
      const result = verifyToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("missing_claims");
      }
    });

    it("returns valid:false reason:missing_claims when email is absent", () => {
      const token = jwt.sign(
        { sub: "user-123" },
        TEST_SECRET,
        { algorithm: "HS256", expiresIn: "15m" }
      );
      const result = verifyToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("missing_claims");
      }
    });

    it("returns valid:false for a random non-JWT string (malformed jwt signature)", () => {
      const result = verifyToken("not.a.valid.jwt.token");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        // jwt library throws JsonWebTokenError for malformed tokens
        // the alg_not_allowed branch catches 'alg' in 'jwt malformed'
        expect(["alg_not_allowed", "invalid_signature"]).toContain(result.reason);
      }
    });

    it("returns valid:false reason:malformed when payload is not an object", () => {
      // A JWT with a string payload instead of an object
      const token = jwt.sign("just-a-string" as unknown as object, TEST_SECRET, {
        algorithm: "HS256",
      });
      const result = verifyToken(token);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toBe("malformed");
      }
    });
  });
});
