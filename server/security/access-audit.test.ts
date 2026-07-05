import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAccessAttempt } from "./access-audit";
import { logger } from "../logger";
import { storage } from "../storage";

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../storage", () => ({
  storage: {
    recordPatientAccess: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("logAccessAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs info for granted access", () => {
    logAccessAttempt("user-1", "Assessment", 42, true, "owner match");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          timestamp: expect.any(String),
          type: "ACCESS_GRANTED",
          userId: "user-1",
          resourceType: "Assessment",
          resourceId: 42,
          reason: "owner match",
        }),
      }),
      "Access Granted"
    );
  });

  it("logs warn for denied access with security flag", () => {
    logAccessAttempt("user-2", "Patient", 99, false, "id mismatch");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({
          type: "ACCESS_DENIED",
          userId: "user-2",
          resourceType: "Patient",
          resourceId: 99,
          reason: "id mismatch",
        }),
        security: true,
      }),
      "Access Denied"
    );
  });

  it("sets authMethod when provided", () => {
    logAccessAttempt("user-1", "Assessment", 42, true, "owner match", "jwt");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({ authMethod: "jwt" }),
      }),
      "Access Granted"
    );
  });

  it("does not set authMethod key when not provided", () => {
    logAccessAttempt("user-1", "Assessment", 42, true, "owner match");
    const callArg = vi.mocked(logger.info).mock.calls[0][0];
    expect(callArg.audit).not.toHaveProperty("authMethod");
  });

  it("calls storage.recordPatientAccess with VIEW action on grant", () => {
    logAccessAttempt("user-1", "Assessment", 42, true, "owner match");
    expect(storage.recordPatientAccess).toHaveBeenCalledWith({
      userId: "user-1",
      resourceType: "Assessment",
      resourceId: "42",
      action: "VIEW",
      ipAddress: undefined,
      userAgent: undefined,
      granted: true,
    });
  });

  it("passes DENIED action and granted=false when access is denied", () => {
    logAccessAttempt("user-1", "Patient", 99, false, "id mismatch");
    expect(storage.recordPatientAccess).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DENIED", granted: false })
    );
  });

  it("passes IP and User-Agent from request when provided", () => {
    const req = {
      ip: "10.0.0.1",
      headers: { "user-agent": "TestAgent/1.0" },
    } as any;
    logAccessAttempt("user-1", "Assessment", 42, true, "owner match", "session", req);
    expect(storage.recordPatientAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        ipAddress: "10.0.0.1",
        userAgent: "TestAgent/1.0",
      })
    );
  });

  it("catches and logs storage errors without throwing", async () => {
    const error = new Error("db unavailable");
    vi.mocked(storage.recordPatientAccess).mockImplementation(
      () => Promise.reject(error)
    );
    // logAccessAttempt attaches .catch() synchronously, so no throw expected
    expect(() =>
      logAccessAttempt("user-1", "Assessment", 42, true, "owner match")
    ).not.toThrow();
    // Flush microtasks so .catch() callback executes
    await Promise.resolve();
    expect(logger.error).toHaveBeenCalledWith(
      { err: error },
      "Failed to persist access audit log"
    );
  });

  it("handles string resourceId correctly", () => {
    logAccessAttempt("user-1", "Assessment", "abc-123", true, "token lookup");
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        audit: expect.objectContaining({ resourceId: "abc-123" }),
      }),
      "Access Granted"
    );
  });
});
