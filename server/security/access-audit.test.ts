import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request } from "express";
import { logAccessAttempt } from "./access-audit";
import { logger } from "../logger";

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockRecordPatientAccess = vi.fn().mockResolvedValue(undefined);
vi.mock("../storage", () => ({
  storage: {
    recordPatientAccess: (...args: any[]) => mockRecordPatientAccess(...args),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Reset so resolved value cache is cleared; each test re-sets as needed
  mockRecordPatientAccess.mockReset();
  mockRecordPatientAccess.mockResolvedValue(undefined);
});

function makeMockReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: "192.168.1.100",
    headers: { "user-agent": "Mozilla/5.0 TestBrowser" },
    ...overrides,
  } as unknown as Request;
}

describe("logAccessAttempt", () => {
  describe("logger calls", () => {
    it("calls logger.info with ACCESS_GRANTED event when granted is true", () => {
      logAccessAttempt("user-1", "Assessment", 42, true, "Owner check passed", "jwt", makeMockReq());
      expect(logger.info).toHaveBeenCalledTimes(1);
      const [meta, msg] = logger.info.mock.calls[0];
      expect(meta.audit.type).toBe("ACCESS_GRANTED");
      expect(meta.audit.userId).toBe("user-1");
      expect(meta.audit.resourceType).toBe("Assessment");
      expect(meta.audit.resourceId).toBe(42);
      expect(msg).toBe("Access Granted");
    });

    it("calls logger.warn with ACCESS_DENIED event and security=true when granted is false", () => {
      logAccessAttempt("user-2", "Patient", 7, false, "RLS policy denied", "session", makeMockReq());
      expect(logger.warn).toHaveBeenCalledTimes(1);
      const [meta, msg] = logger.warn.mock.calls[0];
      expect(meta.audit.type).toBe("ACCESS_DENIED");
      expect(meta.security).toBe(true);
      expect(meta.audit.userId).toBe("user-2");
      expect(msg).toBe("Access Denied");
    });

    it("includes authMethod in the audit event when provided", () => {
      logAccessAttempt("user-1", "Assessment", 1, true, "ok", "jwt", makeMockReq());
      const meta = logger.info.mock.calls[0][0];
      expect(meta.audit.authMethod).toBe("jwt");
    });

    it("does not include authMethod field when not provided", () => {
      logAccessAttempt("user-1", "Assessment", 1, true, "ok", undefined, makeMockReq());
      const meta = logger.info.mock.calls[0][0];
      expect(meta.audit.authMethod).toBeUndefined();
    });
  });

  describe("storage.recordPatientAccess calls", () => {
    it("calls storage.recordPatientAccess with VIEW action when granted is true", async () => {
      logAccessAttempt("user-3", "Assessment", 99, true, "ok", "jwt", makeMockReq());
      // Call count is 1 after logAccessAttempt runs; the .then() fires as microtask
      expect(mockRecordPatientAccess).toHaveBeenCalledTimes(1);
      expect(mockRecordPatientAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-3",
          resourceType: "Assessment",
          resourceId: "99",
          action: "VIEW",
          granted: true,
        })
      );
    });

    it("calls storage.recordPatientAccess with DENIED action when granted is false", async () => {
      logAccessAttempt("user-4", "Patient", 5, false, "forbidden", "session", makeMockReq());
      expect(mockRecordPatientAccess).toHaveBeenCalledTimes(1);
      expect(mockRecordPatientAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-4",
          resourceType: "Patient",
          resourceId: "5",
          action: "DENIED",
          granted: false,
        })
      );
    });

    it("extracts req.ip into ipAddress", async () => {
      logAccessAttempt("user-5", "Assessment", 1, true, "ok", undefined, makeMockReq());
      expect(mockRecordPatientAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "192.168.1.100",
        })
      );
    });

    it("extracts req.headers['user-agent'] into userAgent", async () => {
      logAccessAttempt("user-6", "Assessment", 1, true, "ok", undefined, makeMockReq());
      expect(mockRecordPatientAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: "Mozilla/5.0 TestBrowser",
        })
      );
    });

    it("does not throw when storage.recordPatientAccess rejects", async () => {
      mockRecordPatientAccess.mockReset();
      mockRecordPatientAccess.mockRejectedValueOnce(new Error("Redis down"));
      vi.useFakeTimers();
      logAccessAttempt("user-7", "Assessment", 1, true, "ok", undefined, makeMockReq());
      await vi.advanceTimersByTimeAsync(0);
      vi.useRealTimers();
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error.mock.calls[0][0].err.message).toBe("Redis down");
    });

    it("handles missing req gracefully (req is undefined)", async () => {
      expect(() => logAccessAttempt("user-8", "Assessment", 1, true, "ok", undefined, undefined as any)).not.toThrow();
      expect(mockRecordPatientAccess).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: undefined,
          userAgent: undefined,
        })
      );
    });
  });

  describe("resourceId coercion", () => {
    it("coerces numeric resourceId to string", async () => {
      logAccessAttempt("user-9", "Assessment", 123, true, "ok", undefined, makeMockReq());
      expect(mockRecordPatientAccess).toHaveBeenCalledWith(
        expect.objectContaining({ resourceId: "123" })
      );
    });

    it("passes string resourceId through unchanged", async () => {
      logAccessAttempt("user-10", "Assessment", "abc-def-123", true, "ok", undefined, makeMockReq());
      expect(mockRecordPatientAccess).toHaveBeenCalledWith(
        expect.objectContaining({ resourceId: "abc-def-123" })
      );
    });
  });
});
