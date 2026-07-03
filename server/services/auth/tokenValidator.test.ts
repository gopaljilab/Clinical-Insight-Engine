import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getJwtSecret } from "./tokenValidator";

describe("Environment Configuration Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when JWT_SECRET is missing in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;

    expect(() => getJwtSecret()).toThrow(
      "JWT_SECRET environment variable is required in production."
    );
  });

  it("throws when JWT_SECRET is too short in production", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "short";

    expect(() => getJwtSecret()).toThrow(
      "JWT_SECRET must be at least 32 characters in production."
    );
  });

  it("loads valid JWT_SECRET successfully", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET =
      "this-is-a-valid-jwt-secret-with-more-than-32-characters";

    expect(getJwtSecret()).toBe(process.env.JWT_SECRET);
  });

  it("uses development fallback when JWT_SECRET is missing", () => {
    process.env.NODE_ENV = "development";
    delete process.env.JWT_SECRET;

    expect(getJwtSecret()).toContain("insecure-dev");
  });
});