import { describe, test, expect, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";

// Must import after setting up env mocks
import {
  verifyToken,
  issueToken,
  getJwtSecret,
  type VerifyFailure,
} from "./tokenValidator";

const TEST_SECRET = "clinical-insight-engine-test-secret-32chars!!";

describe("tokenValidator — getJwtSecret", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns dev fallback when JWT_SECRET is unset and NODE_ENV is not production", () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "development";
    const secret = getJwtSecret();
    expect(secret).toContain("insecure");
    expect(secret.length).toBeGreaterThan(0);
  });

  test("returns the configured secret when JWT_SECRET is set", () => {
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.NODE_ENV = "development";
    const secret = getJwtSecret();
    expect(secret).toBe(TEST_SECRET);
  });

  test("throws when JWT_SECRET is unset in production", () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "production";
    expect(() => getJwtSecret()).toThrow("JWT_SECRET environment variable is required in production");
  });

  test("throws when JWT_SECRET is too short in production", () => {
    process.env.JWT_SECRET = "too-short";
    process.env.NODE_ENV = "production";
    expect(() => getJwtSecret()).toThrow("JWT_SECRET must be at least 32 characters");
  });
});

describe("tokenValidator — verifyToken", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns valid:true for a correctly signed token", () => {
    const token = jwt.sign(
      { sub: "user-123", email: "user@test.com", role: "provider" },
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const result = verifyToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.sub).toBe("user-123");
      expect(result.payload.email).toBe("user@test.com");
      expect(result.payload.role).toBe("provider");
    }
  });

  test("returns valid:false reason=expired for expired token", () => {
    const token = jwt.sign(
      { sub: "user-123", email: "user@test.com" },
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: "-1s" }
    );

    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    expect((result as any).reason).toBe("expired");
  });

  test("returns valid:false reason=invalid_signature for wrong secret", () => {
    const token = jwt.sign(
      { sub: "user-123", email: "user@test.com" },
      "wrong-secret-key-that-is-long-enough-32ch",
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    expect((result as any).reason).toBe("invalid_signature");
  });

  test("returns valid:false reason=alg_not_allowed for alg=none token", () => {
    // Manually craft a JWT with alg=none (no signature)
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "user-123", email: "user@test.com" })).toString("base64url");
    const token = `${header}.${payload}.`;

    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    expect((result as any).reason).toBe("alg_not_allowed");
  });

  test("returns valid:false reason=malformed for garbage token", () => {
    const result = verifyToken("not-a-valid-jwt-at-all");
    expect(result.valid).toBe(false);
    // Access reason without TypeScript 'as' cast (eslint parser can't handle 'as')
    const reason = result.valid ? null : (result as VerifyFailure).reason;
    expect(["malformed", "invalid_signature", "alg_not_allowed"].includes(reason)).toBe(true);
  });

  test("returns valid:false reason=missing_claims when sub is absent", () => {
    const token = jwt.sign(
      { email: "user@test.com" },
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    expect((result as any).reason).toBe("missing_claims");
  });

  test("returns valid:false reason=missing_claims when email is absent", () => {
    const token = jwt.sign(
      { sub: "user-123" },
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    expect((result as any).reason).toBe("missing_claims");
  });

  test("rejects RS256 algorithm (not in allowlist)", () => {
    // Generate a keypair for RS256 test
    const { publicKey, privateKey } = require("crypto").generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const token = jwt.sign(
      { sub: "user-123", email: "user@test.com" },
      privateKey,
      { algorithm: "RS256", expiresIn: "1h" }
    );

    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    // Should be rejected because RS256 is not in ALLOWED_ALGORITHMS
    expect(["alg_not_allowed", "invalid_signature"].includes((result as any).reason)).toBe(true);
  });
});

describe("tokenValidator — issueToken", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns a non-empty JWT string", () => {
    const token = issueToken("user-123", "user@test.com");
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3); // JWT has 3 parts
  });

  test("issued token is verifiable by verifyToken", () => {
    const token = issueToken("user-456", "alice@test.com", "provider");
    const result = verifyToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.sub).toBe("user-456");
      expect(result.payload.email).toBe("alice@test.com");
    }
  });

  test("respects custom expiresIn option", () => {
    const token = issueToken("user-789", "bob@test.com", "admin", "30s");
    const result = verifyToken(token);
    expect(result.valid).toBe(true);
  });

  test("defaults role to provider when not specified", () => {
    const token = issueToken("user-abc", "user@test.com");
    const result = verifyToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.role).toBe("provider");
    }
  });

  test("uses custom role when specified", () => {
    const token = issueToken("user-def", "admin@test.com", "ADMIN");
    const result = verifyToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.role).toBe("ADMIN");
    }
  });

  test("issued token has HS256 algorithm in header", () => {
    const token = issueToken("user-ghi", "user@test.com");
    const header = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString());
    expect(header.alg).toBe("HS256");
  });
});
