import { describe, it, expect } from "vitest";
import {
  registerDTOSchema,
  loginDTOSchema,
  forgotPasswordDTOSchema,
  resetPasswordDTOSchema,
  verifyEmailDTOSchema,
  verifyOtpDTOSchema,
} from "./auth.dto";

function assertValid<T>(schema: { parse: (x: unknown) => T }, input: unknown): T {
  return schema.parse(input);
}

function assertInvalid(schema: { parse: (x: unknown) => unknown }, input: unknown): void {
  expect(() => schema.parse(input)).toThrow();
}

// --- registerDTOSchema ---

describe("registerDTOSchema", () => {
  it("parses a valid registration payload", () => {
    const input = {
      fullName: "Dr. Jane Smith",
      email: "jane.smith@hospital.org",
      password: "securePass123",
      licenseNumber: "MED-2024-001",
    };
    const result = assertValid(registerDTOSchema, input);
    expect(result.fullName).toBe("Dr. Jane Smith");
    expect(result.email).toBe("jane.smith@hospital.org");
    expect(result.licenseNumber).toBe("MED-2024-001");
  });

  it("trims fullName and email", () => {
    const input = {
      fullName: "  Dr. Jane Smith  ",
      email: "  jane.smith@hospital.org  ",
      password: "securePass123",
      licenseNumber: "MED-001",
    };
    const result = registerDTOSchema.parse(input);
    expect(result.fullName).toBe("Dr. Jane Smith");
    expect(result.email).toBe("jane.smith@hospital.org");
  });

  it("rejects missing fullName", () => {
    assertInvalid(registerDTOSchema, {
      email: "jane@hospital.org",
      password: "securePass123",
      licenseNumber: "MED-001",
    });
  });

  it("rejects empty fullName", () => {
    assertInvalid(registerDTOSchema, {
      fullName: "   ",
      email: "jane@hospital.org",
      password: "securePass123",
      licenseNumber: "MED-001",
    });
  });

  it("rejects fullName exceeding 255 characters", () => {
    assertInvalid(registerDTOSchema, {
      fullName: "A".repeat(256),
      email: "jane@hospital.org",
      password: "securePass123",
      licenseNumber: "MED-001",
    });
  });

  it("rejects an invalid email", () => {
    assertInvalid(registerDTOSchema, {
      fullName: "Jane Smith",
      email: "not-an-email",
      password: "securePass123",
      licenseNumber: "MED-001",
    });
  });

  it("rejects password shorter than 8 characters", () => {
    assertInvalid(registerDTOSchema, {
      fullName: "Jane Smith",
      email: "jane@hospital.org",
      password: "short",
      licenseNumber: "MED-001",
    });
  });

  it("rejects missing licenseNumber", () => {
    assertInvalid(registerDTOSchema, {
      fullName: "Jane Smith",
      email: "jane@hospital.org",
      password: "securePass123",
    });
  });

  it("rejects licenseNumber exceeding 100 characters", () => {
    assertInvalid(registerDTOSchema, {
      fullName: "Jane Smith",
      email: "jane@hospital.org",
      password: "securePass123",
      licenseNumber: "A".repeat(101),
    });
  });
});

// --- loginDTOSchema ---

describe("loginDTOSchema", () => {
  it("parses a valid login payload", () => {
    const input = {
      email: "jane.smith@hospital.org",
      password: "myPassword123",
    };
    const result = assertValid(loginDTOSchema, input);
    expect(result.email).toBe("jane.smith@hospital.org");
    expect(result.password).toBe("myPassword123");
  });

  it("rejects invalid email format", () => {
    assertInvalid(loginDTOSchema, {
      email: "jane-at-hospital.org",
      password: "myPassword123",
    });
  });

  it("rejects missing password", () => {
    assertInvalid(loginDTOSchema, {
      email: "jane@hospital.org",
    });
  });

  it("rejects empty password", () => {
    assertInvalid(loginDTOSchema, {
      email: "jane@hospital.org",
      password: "",
    });
  });

  it("trims email whitespace", () => {
    const result = loginDTOSchema.parse({
      email: "  jane@hospital.org  ",
      password: "pass123456",
    });
    expect(result.email).toBe("jane@hospital.org");
  });

  it("converts email to lowercase", () => {
    const result = loginDTOSchema.parse({
      email: "JANE@HOSPITAL.ORG",
      password: "pass123456",
    });
    expect(result.email).toBe("jane@hospital.org");
  });
});

// --- forgotPasswordDTOSchema ---

describe("forgotPasswordDTOSchema", () => {
  it("parses a valid email", () => {
    const result = assertValid(forgotPasswordDTOSchema, { email: "user@hospital.org" });
    expect(result.email).toBe("user@hospital.org");
  });

  it("rejects invalid email", () => {
    assertInvalid(forgotPasswordDTOSchema, { email: "notvalid" });
  });

  it("rejects missing email", () => {
    assertInvalid(forgotPasswordDTOSchema, {});
  });
});

// --- resetPasswordDTOSchema ---

describe("resetPasswordDTOSchema", () => {
  it("parses valid token and new password", () => {
    const result = assertValid(resetPasswordDTOSchema, {
      token: "abc123def456",
      newPassword: "newSecurePass99",
    });
    expect(result.token).toBe("abc123def456");
    expect(result.newPassword).toBe("newSecurePass99");
  });

  it("rejects missing token", () => {
    assertInvalid(resetPasswordDTOSchema, { newPassword: "newSecurePass99" });
  });

  it("rejects empty token", () => {
    assertInvalid(resetPasswordDTOSchema, { token: "", newPassword: "newSecurePass99" });
  });

  it("rejects password shorter than 8 characters", () => {
    assertInvalid(resetPasswordDTOSchema, {
      token: "abc123",
      newPassword: "short",
    });
  });
});

// --- verifyEmailDTOSchema ---

describe("verifyEmailDTOSchema", () => {
  it("parses valid email and 6-digit code", () => {
    const result = assertValid(verifyEmailDTOSchema, {
      email: "user@hospital.org",
      code: "123456",
    });
    expect(result.email).toBe("user@hospital.org");
    expect(result.code).toBe("123456");
  });

  it("rejects a code that is not exactly 6 digits", () => {
    assertInvalid(verifyEmailDTOSchema, {
      email: "user@hospital.org",
      code: "12345",
    });
    assertInvalid(verifyEmailDTOSchema, {
      email: "user@hospital.org",
      code: "1234567",
    });
  });

  it("rejects a code with non-numeric characters", () => {
    assertInvalid(verifyEmailDTOSchema, {
      email: "user@hospital.org",
      code: "12a456",
    });
  });

  it("rejects invalid email", () => {
    assertInvalid(verifyEmailDTOSchema, {
      email: "notvalid",
      code: "123456",
    });
  });

  it("rejects missing email", () => {
    assertInvalid(verifyEmailDTOSchema, { code: "123456" });
  });
});

// --- verifyOtpDTOSchema ---

describe("verifyOtpDTOSchema", () => {
  it("parses valid email and OTP", () => {
    const result = assertValid(verifyOtpDTOSchema, {
      email: "user@hospital.org",
      otp: "987654",
    });
    expect(result.email).toBe("user@hospital.org");
    expect(result.otp).toBe("987654");
  });

  it("rejects empty OTP", () => {
    assertInvalid(verifyOtpDTOSchema, {
      email: "user@hospital.org",
      otp: "",
    });
  });

  it("rejects missing OTP", () => {
    assertInvalid(verifyOtpDTOSchema, {
      email: "user@hospital.org",
    });
  });

  it("rejects missing email", () => {
    assertInvalid(verifyOtpDTOSchema, { otp: "123456" });
  });

  it("rejects invalid email", () => {
    assertInvalid(verifyOtpDTOSchema, {
      email: "notvalid",
      otp: "123456",
    });
  });
});
