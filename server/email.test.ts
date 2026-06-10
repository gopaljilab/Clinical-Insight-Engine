import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { mockInfo, mockWarn, mockError } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock("./logger", () => ({
  logger: {
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  },
}));

import {
  sendVerificationEmail as sendVerificationCode,
  sendCriticalRiskAlert,
  validateEmailConfig as validateSmtpConfig,
  EmailConfigurationError,
} from "./email";

const mockResendSend = vi.fn();

vi.mock("resend", () => {
  const mockEmails = { send: (...args: unknown[]) => mockResendSend(...args) };
  return {
    Resend: class {
      constructor(_key: string) {}
      emails = mockEmails;
    },
  };
});

describe("sendVerificationCode", () => {
  beforeEach(() => {
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
    mockResendSend.mockReset();
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not log OTP in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    mockResendSend.mockRejectedValueOnce(new Error("No API key"));
    try {
      const sent = await sendVerificationCode("test@example.com", "123456");
      expect(sent).toBe(false);
      const loggedOutput = mockInfo.mock.calls.map((call: any) => JSON.stringify(call)).join(" ");
      expect(loggedOutput).not.toContain("EMAIL VERIFICATION");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("logs OTP in non-production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const sent = await sendVerificationCode("test@example.com", "123456");
      expect(sent).toBe(true);
      const loggedOutput = mockInfo.mock.calls.map((call: any) => JSON.stringify(call)).join(" ");
      expect(loggedOutput).toContain("123456");
      expect(loggedOutput).toContain("EMAIL VERIFICATION");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("returns false in production when Resend API send fails", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_valid_key";
    mockResendSend.mockResolvedValueOnce({ data: null, error: new Error("Resend API error") });

    try {
      const sent = await sendVerificationCode("test@example.com", "123456");
      expect(sent).toBe(false);
      expect(mockResendSend).toHaveBeenCalledOnce();
    } finally {
      process.env.NODE_ENV = originalEnv;
      delete process.env.RESEND_API_KEY;
    }
  });

  it("returns true in production when Resend API send succeeds", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_valid_key";
    mockResendSend.mockResolvedValueOnce({ data: { id: "test-id" }, error: null });

    try {
      const sent = await sendVerificationCode("test@example.com", "123456");
      expect(sent).toBe(true);
      expect(mockResendSend).toHaveBeenCalledOnce();
    } finally {
      process.env.NODE_ENV = originalEnv;
      delete process.env.RESEND_API_KEY;
    }
  });
});

describe("sendCriticalRiskAlert", () => {
  beforeEach(() => {
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
    mockResendSend.mockReset();
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the critical risk alert in non-production environments", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      const sent = await sendCriticalRiskAlert("doc@example.com", "Jane Doe", 85.5, 123);
      expect(sent).toBe(true);
      const loggedOutput = mockInfo.mock.calls.map((call: any) => JSON.stringify(call)).join(" ");
      expect(loggedOutput).toContain("CRITICAL RISK ALERT MOCK LOG");
      expect(loggedOutput).toContain("doc@example.com");
      expect(loggedOutput).toContain("Jane Doe");
      expect(loggedOutput).toContain("85.5%");
      expect(loggedOutput).toContain("123");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("does not log mock critical risk details to console in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const sent = await sendCriticalRiskAlert("doc@example.com", "Jane Doe", 85.5, 123);
      expect(sent).toBe(false);
      const loggedOutput = mockInfo.mock.calls.map((call: any) => JSON.stringify(call)).join(" ");
      expect(loggedOutput).not.toContain("CRITICAL RISK ALERT MOCK LOG");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe("validateSmtpConfig", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    delete process.env.RESEND_API_KEY;
  });

  it("does not throw outside production", () => {
    process.env.NODE_ENV = "development";
    expect(() => validateSmtpConfig()).not.toThrow();
  });

  it("throws EmailConfigurationError when production RESEND_API_KEY is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.RESEND_API_KEY;
    expect(() => validateSmtpConfig()).toThrow(EmailConfigurationError);
  });

  it("does not throw in production when RESEND_API_KEY is set", () => {
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_valid_key";
    expect(() => validateSmtpConfig()).not.toThrow();
  });
});
