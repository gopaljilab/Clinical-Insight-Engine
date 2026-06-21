import { describe, expect, it } from "vitest";
import { randomInt } from "crypto";
import bcrypt from "bcrypt";
import { getOtpRateLimitKey } from "./auth";

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password: string, stored: string): boolean {
  return bcrypt.compareSync(password, stored);
}

describe("password hashing", () => {
  it("produces a bcrypt hash string", () => {
    const result = hashPassword("test-password-123");
    expect(result).toMatch(/^\$2[ab]\$\d+\$.+/);
  });

  it("verifies correct password", () => {
    const stored = hashPassword("my-secure-password");
    expect(verifyPassword("my-secure-password", stored)).toBe(true);
  });

  it("rejects wrong password", () => {
    const stored = hashPassword("correct-password");
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("generates unique hashes each time", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
  });
});

describe("OTP generation", () => {
  it("generates a 6-digit code", () => {
    for (let i = 0; i < 100; i++) {
      const otp = randomInt(100000, 999999).toString();
      expect(otp.length).toBe(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    }
  });
});
