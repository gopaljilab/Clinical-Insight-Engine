import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  sendVerificationCode,
  sendCriticalRiskAlert,
  validateSmtpConfig,
  EmailConfigurationError,
} from "./email";
import { logger } from "./logger";

const mockSendMail = vi.fn();
const mockCreateTransport = vi.fn(() => ({ sendMail: mockSendMail }));

vi.mock("nodemailer", () => ({
  createTransport: (...args: unknown[]) => mockCreateTransport(...args),
}));

describe("sendVerificationCode", () => {
  let logSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.spyOn(logger, "error").mockImplementation(() => {});
    mockSendMail.mockReset();
    mockCreateTransport.mockClear();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not log OTP in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const sent = await sendVerificationCode("test@example.com", "123456");
      expect(sent).toBe(false);
      const loggedOutput = JSON.stringify(logSpy.mock.calls);
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
      const loggedOutput = JSON.stringify(logSpy.mock.calls);
      expect(loggedOutput).toContain("123456");
      expect(loggedOutput).toContain("EMAIL VERIFICATION");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("returns false in production when SMTP send fails", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    mockSendMail.mockRejectedValueOnce(new Error("SMTP auth failed"));

    try {
      const sent = await sendVerificationCode("test@example.com", "123456");
      expect(sent).toBe(false);
      expect(mockSendMail).toHaveBeenCalledOnce();
    } finally {
      process.env.NODE_ENV = originalEnv;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
    }
  });

  it("returns true in production when SMTP send succeeds", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    mockSendMail.mockResolvedValueOnce({ messageId: "test-id" });

    try {
      const sent = await sendVerificationCode("test@example.com", "123456");
      expect(sent).toBe(true);
      expect(mockSendMail).toHaveBeenCalledOnce();
    } finally {
      process.env.NODE_ENV = originalEnv;
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_PORT;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
    }
  });
});

describe("sendCriticalRiskAlert", () => {
  let logSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.spyOn(logger, "error").mockImplementation(() => {});
    mockSendMail.mockReset();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
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
      const loggedOutput = JSON.stringify(logSpy.mock.calls);
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
      const loggedOutput = JSON.stringify(logSpy.mock.calls);
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
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  it("does not throw outside production", () => {
    process.env.NODE_ENV = "development";
    expect(() => validateSmtpConfig()).not.toThrow();
  });

  it("throws EmailConfigurationError when production SMTP vars are missing", () => {
    process.env.NODE_ENV = "production";
    expect(() => validateSmtpConfig()).toThrow(EmailConfigurationError);
  });

  it("does not throw in production when all SMTP vars are set", () => {
    process.env.NODE_ENV = "production";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    expect(() => validateSmtpConfig()).not.toThrow();
  });
});
