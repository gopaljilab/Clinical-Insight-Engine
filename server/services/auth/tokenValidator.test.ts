import { verifyToken, getJwtSecret, issueToken } from "./tokenValidator";

describe("getJwtSecret", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it("returns JWT_SECRET from environment when set", () => {
    process.env.JWT_SECRET = "super-secret-key-that-is-long-enough-32chars";
    process.env.NODE_ENV = "development";
    const secret = getJwtSecret();
    expect(secret).toBe("super-secret-key-that-is-long-enough-32chars");
  });

  it("throws in production when JWT_SECRET is not set", () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "production";
    expect(() => getJwtSecret()).toThrow(
      "JWT_SECRET environment variable is required in production"
    );
  });

  it("returns fallback secret in development when JWT_SECRET is not set", () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = "development";
    const secret = getJwtSecret();
    expect(secret).toContain("clinical-insight-engine");
  });

  it("throws in production when JWT_SECRET is too short", () => {
    process.env.JWT_SECRET = "short";
    process.env.NODE_ENV = "production";
    expect(() => getJwtSecret()).toThrow(
      "JWT_SECRET must be at least 32 characters"
    );
  });
});

describe("verifyToken", () => {
  const TEST_SECRET = "test-secret-key-that-is-long-enough-for-testing-32c";

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.NODE_ENV = "test";
  });

  it("returns valid result for a properly signed token", () => {
    const token = issueToken("user-123", "alice@example.com", "provider", "1h");
    const result = verifyToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.sub).toBe("user-123");
      expect(result.payload.email).toBe("alice@example.com");
      expect(result.payload.role).toBe("provider");
    }
  });

  it("returns expired for an expired token", () => {
    const token = issueToken("user-123", "alice@example.com", "provider", "-1s");
    // Wait for token to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const result = verifyToken(token);
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.reason).toBe("expired");
        }
        resolve();
      }, 50);
    });
  });

  it("returns invalid_signature for a token signed with wrong secret", () => {
    // Issue with a different secret
    const wrongSecret = "wrong-secret-key-that-is-also-long-enough-32chars";
    const token = require("jsonwebtoken").sign(
      { sub: "user-123", email: "alice@example.com" },
      wrongSecret,
      { algorithm: "HS256", expiresIn: "1h" }
    );
    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("invalid_signature");
    }
  });

  it("returns malformed for an invalid JWT string", () => {
    const result = verifyToken("not.a.valid.jwt.string");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(["invalid_signature", "malformed"]).toContain(result.reason);
    }
  });

  it("returns missing_claims when sub claim is absent", () => {
    const token = require("jsonwebtoken").sign(
      { email: "alice@example.com" },
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );
    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("missing_claims");
    }
  });

  it("returns missing_claims when email claim is absent", () => {
    const token = require("jsonwebtoken").sign(
      { sub: "user-123" },
      TEST_SECRET,
      { algorithm: "HS256", expiresIn: "1h" }
    );
    const result = verifyToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("missing_claims");
    }
  });

  it("accepts token with role claim", () => {
    const token = issueToken("user-456", "bob@example.com", "admin", "1h");
    const result = verifyToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.role).toBe("admin");
    }
  });
});
