import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendVerificationCode, sendCriticalRiskAlert } from "./email";
import { logger } from "./logger";

describe("sendVerificationCode", () => {
  let logSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not log OTP in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await sendVerificationCode("test@example.com", "123456");
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
      await sendVerificationCode("test@example.com", "123456");
      const loggedOutput = JSON.stringify(logSpy.mock.calls);
      expect(loggedOutput).toContain("123456");
      expect(loggedOutput).toContain("EMAIL VERIFICATION");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe("sendCriticalRiskAlert", () => {
  let logSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the critical risk alert in non-production environments", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      await sendCriticalRiskAlert("doc@example.com", "Jane Doe", 85.5, 123);
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
      await sendCriticalRiskAlert("doc@example.com", "Jane Doe", 85.5, 123);
      const loggedOutput = JSON.stringify(logSpy.mock.calls);
      expect(loggedOutput).not.toContain("CRITICAL RISK ALERT MOCK LOG");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
