import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../logger", () => {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock("../storage", () => {
  return {
    storage: {
      recordPatientAccess: vi.fn().mockResolvedValue(undefined),
    },
  };
});

import { logAccessAttempt } from "./access-audit";
import { logger } from "../logger";
import { storage } from "../storage";

describe("logAccessAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs ACCESS_GRANTED event with correct audit structure", () => {
    const req = {
      ip: "192.168.1.1",
      headers: { "user-agent": "Mozilla/5.0" },
    } as any;

    logAccessAttempt("user-123", "Assessment", 42, true, "Owner access", "session", req);

    expect(logger.info).toHaveBeenCalledTimes(1);
    const logged = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(logged.audit.type).toBe("ACCESS_GRANTED");
    expect(logged.audit.userId).toBe("user-123");
    expect(logged.audit.resourceType).toBe("Assessment");
    expect(logged.audit.resourceId).toBe(42);
    expect(logged.audit.reason).toBe("Owner access");
    expect(logged.audit.authMethod).toBe("session");
  });

  it("logs ACCESS_DENIED event with security flag and does not throw", () => {
    const req = {
      ip: "10.0.0.1",
      headers: { "user-agent": "curl/7.68.0" },
    } as any;

    expect(() => {
      logAccessAttempt("user-456", "Patient", 99, false, "IDOR blocked", "jwt", req);
    }).not.toThrow();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const logged = (logger.warn as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(logged.audit.type).toBe("ACCESS_DENIED");
    expect(logged.security).toBe(true);
  });

  it("includes optional authMethod when provided", () => {
    const req = {} as any;
    logAccessAttempt("u1", "Report", 7, true, "admin access", "api_key", req);
    const logged = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(logged.audit.authMethod).toBe("api_key");
  });

  it("omits authMethod from audit event when not provided", () => {
    const req = {} as any;
    logAccessAttempt("u1", "Report", 7, true, "granted", undefined, req);
    const logged = (logger.info as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect("authMethod" in logged.audit).toBe(false);
  });

  it("calls storage.recordPatientAccess with VIEW action on granted access", async () => {
    const req = {
      ip: "1.2.3.4",
      headers: { "user-agent": "TestAgent" },
    } as any;
    (storage.recordPatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    logAccessAttempt("uid789", "Assessment", 55, true, "granted", "session", req);

    await Promise.resolve();
    expect(storage.recordPatientAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "uid789",
        resourceType: "Assessment",
        resourceId: "55",
        action: "VIEW",
        granted: true,
      })
    );
  });

  it("calls storage.recordPatientAccess with DENIED action on denied access", async () => {
    const req = {} as any;
    (storage.recordPatientAccess as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    logAccessAttempt("uid999", "Patient", 88, false, "denied", "session", req);

    await Promise.resolve();
    expect(storage.recordPatientAccess).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DENIED", granted: false })
    );
  });

  it("completes without error when storage.recordPatientAccess is not a function", () => {
    // Override the mock for this specific test
    const originalRecord = storage.recordPatientAccess;
    (storage as any).recordPatientAccess = undefined;

    expect(() => {
      logAccessAttempt("u1", "Assessment", 1, true, "test", undefined, {} as any);
    }).not.toThrow();

    // Restore
    (storage as any).recordPatientAccess = originalRecord;
  });
});
