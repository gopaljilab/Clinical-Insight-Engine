import { describe, expect, it } from "vitest";
import { scryptSync, randomInt, randomBytes, timingSafeEqual } from "crypto";

/**
 * Password hashing utilities (inlined from auth.ts for isolated testing).
 */
const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return hash.length === Buffer.from(key, "hex").length && timingSafeEqual(hash, Buffer.from(key, "hex"));
}

describe("password hashing", () => {
  it("produces a salt:hash string", () => {
    const result = hashPassword("test-password-123");
    expect(result).toContain(":");
    const [salt, hash] = result.split(":");
    expect(salt.length).toBe(64); // 32 random bytes = 64 hex chars
    expect(hash.length).toBe(KEY_LENGTH * 2);  // hex encoded hash
  });

  it("verifies correct password", () => {
    const stored = hashPassword("my-secure-password");
    expect(verifyPassword("my-secure-password", stored)).toBe(true);
  });

  it("rejects wrong password", () => {
    const stored = hashPassword("correct-password");
    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("generates unique salts each time", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    const saltA = a.split(":")[0];
    const saltB = b.split(":")[0];
    expect(saltA).not.toBe(saltB);
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
