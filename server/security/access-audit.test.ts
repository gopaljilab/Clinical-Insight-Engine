import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";
import { logAccessAttempt } from "./access-audit";
import { logger } from "../logger";
import { storage } from "../storage";

// --- Mock dependencies ---

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

  it("logs ACCESS_GRANTED event with correct audit data", () => {
    logAccessAttempt("user-123", "Assessment", 42, true, "Authorized access");

    expect(vi.mocked(logger.info)).toHaveBeenCalledTimes(1);
    const [logObj, logMsg] = vi.mocked(logger.info).mock.calls[0];
    expect(logObj.audit.type).toBe("ACCESS_GRANTED");
    expect(logObj.audit.userId).toBe("user-123");
    expect(logObj.audit.resourceType).toBe("Assessment");
    expect(logObj.audit.resourceId).toBe(42);
    expect(logObj.audit.reason).toBe("Authorized access");
  });

  it("logs ACCESS_DENIED event with security flag set", () => {
    logAccessAttempt("user-456", "Patient", 99, false, "IDOR attempt detected");

    expect(vi.mocked(logger.warn)).toHaveBeenCalledTimes(1);
    const [logObj] = vi.mocked(logger.warn).mock.calls[0];
    expect(logObj.audit.type).toBe("ACCESS_DENIED");
    expect(logObj.security).toBe(true);
  });

  it("includes authMethod when provided", () => {
    logAccessAttempt("user-789", "Assessment", 1, true, "Authorized", "jwt");

    const logObj = vi.mocked(logger.info).mock.calls[0][0];
    expect(logObj.audit.authMethod).toBe("jwt");
  });

  it("does not include authMethod when not provided", () => {
    logAccessAttempt("user-000", "Assessment", 2, true, "Authorized");

    const logObj = vi.mocked(logger.info).mock.calls[0][0];
    expect("authMethod" in logObj.audit).toBe(false);
  });

  it("includes IP address from request when provided", () => {
    const mockReq = { ip: "192.168.1.100" } as unknown as Request;
    logAccessAttempt("user-abc", "Assessment", 3, true, "Authorized", undefined, mockReq);

    expect(vi.mocked(storage.recordPatientAccess)).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: "192.168.1.100" })
    );
  });

  it("calls storage.recordPatientAccess with VIEW action on granted access", () => {
    logAccessAttempt("user-def", "Assessment", 5, true, "Authorized");

    expect(vi.mocked(storage.recordPatientAccess)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-def",
        resourceType: "Assessment",
        resourceId: "5",
        action: "VIEW",
        granted: true,
      })
    );
  });

  it("calls storage.recordPatientAccess with DENIED action on denied access", () => {
    logAccessAttempt("user-ghi", "Patient", 7, false, "Unauthorized");

    expect(vi.mocked(storage.recordPatientAccess)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-ghi",
        resourceType: "Patient",
        resourceId: "7",
        action: "DENIED",
        granted: false,
      })
    );
  });

  it("handles string resourceId correctly", () => {
    logAccessAttempt("user-jkl", "Assessment", "abc-123", true, "Authorized");
    const logObj = vi.mocked(logger.info).mock.calls[0][0];
    expect(logObj.audit.resourceId).toBe("abc-123");
  });

  it("logs timestamp in ISO format", () => {
    logAccessAttempt("user-mno", "Assessment", 10, true, "Authorized");
    const logObj = vi.mocked(logger.info).mock.calls[0][0];
    expect(logObj.audit.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
