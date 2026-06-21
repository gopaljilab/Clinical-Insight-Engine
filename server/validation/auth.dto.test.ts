/**
 * Unit tests for server/validation/auth.dto.ts
 * Covers Zod schemas for registration, login, password reset, email verification, and OTP.
 */
import { describe, expect, it } from "vitest";
import {
  registerDTOSchema,
  loginDTOSchema,
  forgotPasswordDTOSchema,
  resetPasswordDTOSchema,
  verifyEmailDTOSchema,
  verifyOtpDTOSchema,
} from "./auth.dto";

// ─── registerDTOSchema Tests ─────────────────────────────────────────────────

describe("registerDTOSchema", () => {
  const validPayload = {
    fullName: "Dr. Jane Doe",
    email: "jane.doe@hospital.org",
    password: "SecurePass123",
    licenseNumber: "MD-123456",
  };

  it("accepts a valid registration payload", () => {
    const result = registerDTOSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("trims whitespace from fullName and email", () => {
    const result = registerDTOSchema.safeParse({ ...validPayload, fullName: "  Dr. Jane Doe  ", email: "  jane.doe@hospital.org  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Dr. Jane Doe");
      expect(result.data.email).toBe("jane.doe@hospital.org");
    }
  });

  it("lowercases email", () => {
    const result = registerDTOSchema.safeParse({ ...validPayload, email: "Jane.Doe@Hospital.Org" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jane.doe@hospital.org");
    }
  });

  it("rejects empty fullName", () => {
    const result = registerDTOSchema.safeParse({ ...validPayload, fullName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects fullName exceeding 255 characters", () => {
    const result = registerDTOSchema.safeParse({ ...validPayload, fullName: "A".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = registerDTOSchema.safeParse({ ...validPayload, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = registerDTOSchema.safeParse({ ...validPayload, password: "short1" });
    expect(result.success).toBe(false);
  });

  it("rejects empty licenseNumber", () => {
    const result = registerDTOSchema.safeParse({ ...validPayload, licenseNumber: "" });
    expect(result.success).toBe(false);
  });
});

// ─── loginDTOSchema Tests ────────────────────────────────────────────────────

describe("loginDTOSchema", () => {
  const validPayload = {
    email: "doctor@hospital.org",
    password: "password123",
  };

  it("accepts a valid login payload", () => {
    const result = loginDTOSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("trims and lowercases email", () => {
    const result = loginDTOSchema.safeParse({ email: "  Doctor@Hospital.Org  ", password: "password123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("doctor@hospital.org");
    }
  });

  it("rejects empty email", () => {
    const result = loginDTOSchema.safeParse({ email: "", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = loginDTOSchema.safeParse({ email: "no-at-sign.com", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginDTOSchema.safeParse({ email: "doctor@hospital.org", password: "" });
    expect(result.success).toBe(false);
  });
});

// ─── forgotPasswordDTOSchema Tests ──────────────────────────────────────────

describe("forgotPasswordDTOSchema", () => {
  it("accepts a valid email", () => {
    const result = forgotPasswordDTOSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = forgotPasswordDTOSchema.safeParse({ email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = forgotPasswordDTOSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });
});

// ─── resetPasswordDTOSchema Tests ───────────────────────────────────────────

describe("resetPasswordDTOSchema", () => {
  const validPayload = {
    token: "abc123def456",
    newPassword: "NewSecurePass123",
  };

  it("accepts a valid reset payload", () => {
    const result = resetPasswordDTOSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects empty token", () => {
    const result = resetPasswordDTOSchema.safeParse({ token: "", newPassword: "NewSecurePass123" });
    expect(result.success).toBe(false);
  });

  it("rejects password shorter than 8 characters", () => {
    const result = resetPasswordDTOSchema.safeParse({ token: "abc123", newPassword: "short" });
    expect(result.success).toBe(false);
  });
});

// ─── verifyEmailDTOSchema Tests ─────────────────────────────────────────────

describe("verifyEmailDTOSchema", () => {
  const validPayload = {
    email: "user@example.com",
    code: "123456",
  };

  it("accepts a valid email verification payload", () => {
    const result = verifyEmailDTOSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects code that is not exactly 6 digits", () => {
    const result = verifyEmailDTOSchema.safeParse({ ...validPayload, code: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejects code with letters", () => {
    const result = verifyEmailDTOSchema.safeParse({ ...validPayload, code: "12345a" });
    expect(result.success).toBe(false);
  });

  it("rejects code with 7 digits", () => {
    const result = verifyEmailDTOSchema.safeParse({ ...validPayload, code: "1234567" });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = verifyEmailDTOSchema.safeParse({ email: "", code: "123456" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = verifyEmailDTOSchema.safeParse({ email: "not-email", code: "123456" });
    expect(result.success).toBe(false);
  });
});

// ─── verifyOtpDTOSchema Tests ───────────────────────────────────────────────

describe("verifyOtpDTOSchema", () => {
  const validPayload = {
    email: "user@example.com",
    otp: "789012",
  };

  it("accepts a valid OTP payload", () => {
    const result = verifyOtpDTOSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects empty OTP", () => {
    const result = verifyOtpDTOSchema.safeParse({ email: "user@example.com", otp: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = verifyOtpDTOSchema.safeParse({ email: "", otp: "789012" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email format", () => {
    const result = verifyOtpDTOSchema.safeParse({ email: "no-email", otp: "789012" });
    expect(result.success).toBe(false);
  });
});