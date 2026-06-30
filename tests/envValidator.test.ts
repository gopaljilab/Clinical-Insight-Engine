import { describe, expect, it, beforeEach } from "vitest";
import { validateEnv, REQUIRED_VARS } from "../server/config/envValidator";

beforeEach(() => {
  delete process.env.DATABASE_URL;
  delete process.env.JWT_SECRET;
  delete process.env.SESSION_SECRET;
  delete process.env.RESEND_API_KEY;
  delete process.env.PORT;
  delete process.env.NODE_ENV;
  delete process.env.LOG_LEVEL;
  delete process.env.CORS_ORIGINS;
  delete process.env.REDIS_URL;
  delete process.env.HCAPTCHA_SECRET;
  delete process.env.HCAPTCHA_SITE_KEY;
});

describe("validateEnv", () => {
  it("returns valid:true when all required variables are set", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/db";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.SESSION_SECRET = "session-secret";
    process.env.RESEND_API_KEY = "resend-key";

    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
    expect(result.typeErrors).toHaveLength(0);
  });

  it("reports all missing required variables at once", () => {
    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(4);
    expect(result.missing[0]).toContain("DATABASE_URL");
    expect(result.missing[1]).toContain("JWT_SECRET");
    expect(result.missing[2]).toContain("SESSION_SECRET");
    expect(result.missing[3]).toContain("RESEND_API_KEY");
  });

  it("reports missing variables with their descriptions", () => {
    const result = validateEnv();
    expect(result.missing[0]).toContain("PostgreSQL connection string");
  });

  it("does not report optional variables as missing", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/db";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.SESSION_SECRET = "session-secret";
    process.env.RESEND_API_KEY = "resend-key";

    const result = validateEnv();
    expect(result.missing).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it("reports type error when PORT is non-numeric", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/db";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.SESSION_SECRET = "session-secret";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.PORT = "not-a-number";

    const result = validateEnv();
    expect(result.typeErrors).toHaveLength(1);
    expect(result.typeErrors[0]).toContain("PORT");
    expect(result.typeErrors[0]).toContain("numeric");
  });

  it("accepts valid PORT numeric string", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/db";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.SESSION_SECRET = "session-secret";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.PORT = "8080";

    const result = validateEnv();
    expect(result.typeErrors).toHaveLength(0);
  });

  it("reports type error when NODE_ENV is invalid", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/db";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.SESSION_SECRET = "session-secret";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.NODE_ENV = "staging";

    const result = validateEnv();
    expect(result.typeErrors).toHaveLength(1);
    expect(result.typeErrors[0]).toContain("NODE_ENV");
    expect(result.typeErrors[0]).toContain("development");
  });

  it("accepts valid NODE_ENV values", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/db";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.SESSION_SECRET = "session-secret";
    process.env.RESEND_API_KEY = "resend-key";

    for (const env of ["development", "production", "test"]) {
      process.env.NODE_ENV = env;
      const result = validateEnv();
      expect(result.typeErrors).toHaveLength(0);
    }
  });

  it("reports type error when LOG_LEVEL is invalid", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/db";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.SESSION_SECRET = "session-secret";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.LOG_LEVEL = "verbose";

    const result = validateEnv();
    expect(result.typeErrors).toHaveLength(1);
    expect(result.typeErrors[0]).toContain("LOG_LEVEL");
  });

  it("returns valid:true even when optional vars have type errors", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/db";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.SESSION_SECRET = "session-secret";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.NODE_ENV = "staging";

    const result = validateEnv();
    expect(result.valid).toBe(true);
    expect(result.typeErrors).toHaveLength(1);
  });

  it("reports multiple type errors simultaneously", () => {
    process.env.DATABASE_URL = "postgres://localhost:5432/db";
    process.env.JWT_SECRET = "jwt-secret";
    process.env.SESSION_SECRET = "session-secret";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.PORT = "abc";
    process.env.NODE_ENV = "staging";
    process.env.LOG_LEVEL = "verbose";

    const result = validateEnv();
    expect(result.typeErrors).toHaveLength(3);
  });

  it("handles empty values the same as missing", () => {
    process.env.DATABASE_URL = "";
    process.env.JWT_SECRET = "";
    process.env.SESSION_SECRET = "";
    process.env.RESEND_API_KEY = "";

    const result = validateEnv();
    expect(result.valid).toBe(false);
    expect(result.missing).toHaveLength(4);
  });
});
