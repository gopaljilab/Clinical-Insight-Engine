import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendVerificationCode } from "./email";

describe("sendVerificationCode", () => {
  let logSpy: any;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not log OTP in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await sendVerificationCode("test@example.com", "123456");
      const loggedOutput = logSpy.mock.calls.map((call: any) => call.join(" ")).join(" ");
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
      const loggedOutput = logSpy.mock.calls.map((call: any) => call.join(" ")).join(" ");
      expect(loggedOutput).toContain("123456");
      expect(loggedOutput).toContain("EMAIL VERIFICATION");
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
