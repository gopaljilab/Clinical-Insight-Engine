import { describe, it, expect } from "vitest";
import {
  registerDTOSchema,
  loginDTOSchema,
  forgotPasswordDTOSchema,
  resetPasswordDTOSchema,
  verifyEmailDTOSchema,
  verifyOtpDTOSchema,
} from "./auth.dto";

describe("registerDTOSchema", () => {
  const validPayload = {
    fullName: "Dr. Jane Smith",
    email: "jane.smith@hospital.org",
    password: "SecurePass123!",
    licenseNumber: "MD-2024-12345",
  };

  it("accepts a valid registration payload", () => {
    expect(() => registerDTOSchema.parse(validPayload)).not.toThrow();
  });

  it("rejects empty fullName", () => {
    expect(() =>
      registerDTOSchema.parse({ ...validPayload, fullName: "" })
    ).toThrow();
  });

  it("rejects whitespace-only fullName", () => {
    expect(() =>
      registerDTOSchema.parse({ ...validPayload, fullName: "   " })
    ).toThrow();
  });

  it("rejects fullName exceeding 255 characters", () => {
    expect(() =>
      registerDTOSchema.parse({ ...validPayload, fullName: "A".repeat(256) })
    ).toThrow();
  });

  it("rejects invalid email format", () => {
    expect(() =>
      registerDTOSchema.parse({ ...validPayload, email: "not-an-email" })
    ).toThrow();
  });

  it("accepts max-length fullName (255 chars)", () => {
    expect(() =>
      registerDTOSchema.parse({
        ...validPayload,
        fullName: "A".repeat(255),
      })
    ).not.toThrow();
  });

  it("rejects password shorter than 8 characters", () => {
    expect(() =>
      registerDTOSchema.parse({ ...validPayload, password: "Short1!" })
    ).toThrow();
  });

  it("rejects empty licenseNumber", () => {
    expect(() =>
      registerDTOSchema.parse({ ...validPayload, licenseNumber: "" })
    ).toThrow();
  });

  it("rejects licenseNumber exceeding 100 characters", () => {
    expect(() =>
      registerDTOSchema.parse({
        ...validPayload,
        licenseNumber: "X".repeat(101),
      })
    ).toThrow();
  });

  it("lowercases email on valid input", () => {
    const result = registerDTOSchema.parse({
      ...validPayload,
      email: "JANE.SMITH@HOSPITAL.ORG",
    });
    expect(result.email).toBe("jane.smith@hospital.org");
  });
});

describe("loginDTOSchema", () => {
  const validPayload = {
    email: "doctor@hospital.org",
    password: "my-secret-password",
  };

  it("accepts a valid login payload", () => {
    expect(() => loginDTOSchema.parse(validPayload)).not.toThrow();
  });

  it("rejects invalid email format", () => {
    expect(() =>
      loginDTOSchema.parse({ ...validPayload, email: "notanemail" })
    ).toThrow();
  });

  it("rejects empty password", () => {
    expect(() =>
      loginDTOSchema.parse({ ...validPayload, password: "" })
    ).toThrow();
  });

  it("accepts whitespace-only password (min-length check only)", () => {
    // z.string().min(1) does not trim, so whitespace-only passes length check
    expect(() =>
      loginDTOSchema.parse({ ...validPayload, password: "    " })
    ).not.toThrow();
  });

  it("lowercases email on valid input", () => {
    const result = loginDTOSchema.parse({
      ...validPayload,
      email: "DOCTOR@HOSPITAL.ORG",
    });
    expect(result.email).toBe("doctor@hospital.org");
  });
});

describe("forgotPasswordDTOSchema", () => {
  it("accepts a valid email", () => {
    expect(() =>
      forgotPasswordDTOSchema.parse({ email: "user@example.com" })
    ).not.toThrow();
  });

  it("rejects invalid email format", () => {
    expect(() =>
      forgotPasswordDTOSchema.parse({ email: "not-an-email" })
    ).toThrow();
  });

  it("rejects empty email", () => {
    expect(() => forgotPasswordDTOSchema.parse({ email: "" })).toThrow();
  });
});

describe("resetPasswordDTOSchema", () => {
  const validPayload = {
    token: "abc123def456",
    newPassword: "NewSecurePass99!",
  };

  it("accepts a valid reset payload", () => {
    expect(() => resetPasswordDTOSchema.parse(validPayload)).not.toThrow();
  });

  it("rejects empty token", () => {
    expect(() =>
      resetPasswordDTOSchema.parse({ ...validPayload, token: "" })
    ).toThrow();
  });

  it("rejects newPassword shorter than 8 characters", () => {
    expect(() =>
      resetPasswordDTOSchema.parse({ ...validPayload, newPassword: "Short1" })
    ).toThrow();
  });
});

describe("verifyEmailDTOSchema", () => {
  const validPayload = {
    email: "user@example.com",
    code: "123456",
  };

  it("accepts a valid verification payload", () => {
    expect(() => verifyEmailDTOSchema.parse(validPayload)).not.toThrow();
  });

  it("rejects code that is not exactly 6 digits", () => {
    expect(() =>
      verifyEmailDTOSchema.parse({ ...validPayload, code: "12345" })
    ).toThrow();
  });

  it("rejects code with letters", () => {
    expect(() =>
      verifyEmailDTOSchema.parse({ ...validPayload, code: "12345a" })
    ).toThrow();
  });

  it("rejects code longer than 6 digits", () => {
    expect(() =>
      verifyEmailDTOSchema.parse({ ...validPayload, code: "1234567" })
    ).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() =>
      verifyEmailDTOSchema.parse({ ...validPayload, email: "bademail" })
    ).toThrow();
  });
});

describe("verifyOtpDTOSchema", () => {
  const validPayload = {
    email: "user@example.com",
    otp: "882211",
  };

  it("accepts a valid OTP payload", () => {
    expect(() => verifyOtpDTOSchema.parse(validPayload)).not.toThrow();
  });

  it("rejects empty OTP", () => {
    expect(() =>
      verifyOtpDTOSchema.parse({ ...validPayload, otp: "" })
    ).toThrow();
  });

  it("rejects whitespace OTP (schema requires exactly 6 digits)", () => {
    expect(() =>
      verifyOtpDTOSchema.parse({ ...validPayload, otp: "   " })
    ).toThrow();
  });

  it("rejects invalid email format", () => {
    expect(() =>
      verifyOtpDTOSchema.parse({ ...validPayload, email: "not-an-email" })
    ).toThrow();
  });
});
