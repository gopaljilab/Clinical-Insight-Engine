import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { mockInfo, mockWarn, mockError, mockSend } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock("./logger", () => ({
  logger: {
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  },
}));

vi.mock("resend", () => {
  return {
    Resend: vi.fn().mockImplementation(() => {
      return {
        emails: {
          send: mockSend,
        },
      };
    }),
  };
});

import {
  sendVerificationEmail,
  sendCriticalRiskAlert,
  validateEmailConfig,
  EmailConfigurationError,
} from "./email";

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
    mockSend.mockReset();
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not log OTP in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockResolvedValueOnce({ data: { id: "test-id" }, error: null });
    try {
      const sent = await sendVerificationEmail("test@example.com", "123456");
      expect(sent).toBe(true);
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
      const sent = await sendVerificationEmail("test@example.com", "123456");
      expect(sent).toBe(true);
      const loggedOutput = mockInfo.mock.calls.map((call: any) => JSON.stringify(call)).join(" ");
      expect(loggedOutput).toContain("123456");
      expect(loggedOutput).toContain("EMAIL VERIFICATION");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("returns false in production when Resend send fails", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockResolvedValueOnce({ data: null, error: { message: "API error" } });

    try {
      const sent = await sendVerificationEmail("test@example.com", "123456");
      expect(sent).toBe(false);
      expect(mockSend).toHaveBeenCalledOnce();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("returns true in production when Resend send succeeds", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockResolvedValueOnce({ data: { id: "test-id" }, error: null });

    try {
      const sent = await sendVerificationEmail("test@example.com", "123456");
      expect(sent).toBe(true);
      expect(mockSend).toHaveBeenCalledOnce();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe("sendCriticalRiskAlert", () => {
  beforeEach(() => {
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
    mockSend.mockReset();
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
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockResolvedValueOnce({ data: { id: "test-id" }, error: null });
    try {
      const sent = await sendCriticalRiskAlert("doc@example.com", "Jane Doe", 85.5, 123);
      expect(sent).toBe(true);
      const loggedOutput = mockInfo.mock.calls.map((call: any) => JSON.stringify(call)).join(" ");
      expect(loggedOutput).not.toContain("CRITICAL RISK ALERT MOCK LOG");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe("validateEmailConfig", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    delete process.env.RESEND_API_KEY;
  });

  it("does not throw outside production", () => {
    process.env.NODE_ENV = "development";
    expect(() => validateEmailConfig()).not.toThrow();
  });

  it("throws EmailConfigurationError when production Resend key is missing", () => {
    process.env.NODE_ENV = "production";
    expect(() => validateEmailConfig()).toThrow(EmailConfigurationError);
  });

  it("does not throw in production when Resend key is set", () => {
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "re_test_key";
    expect(() => validateEmailConfig()).not.toThrow();
  });
});
