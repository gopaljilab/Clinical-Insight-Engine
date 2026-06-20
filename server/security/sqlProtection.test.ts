import { describe, it, expect, vi, beforeEach } from "vitest";
import { logSecurityEvent, sanitizeDatabaseError } from "./sqlProtection";
import type { Request } from "express";

const mockWarn = vi.fn();
const mockError = vi.fn();

vi.mock("../logger", () => ({
  logger: {
    warn: (...args: any[]) => mockWarn(...args),
    error: (...args: any[]) => mockError(...args),
    info: vi.fn(),
  },
}));

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ip: "127.0.0.1",
    path: "/api/assessments",
    method: "GET",
    ...overrides,
  } as unknown as Request;
}

describe("sqlProtection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T09:30:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("logSecurityEvent", () => {
    it("returns a correctly shaped SecurityEvent with all required fields", () => {
      const req = makeReq();
      logSecurityEvent("UNAUTHORIZED_SEARCH_ACCESS", "Missing token", req);

      const [logObj, message] = mockWarn.mock.calls[0];
      expect(message).toBe("Security Event");
      expect(logObj.securityEvent).toMatchObject({
        timestamp: "2026-02-01T09:30:00.000Z",
        type: "UNAUTHORIZED_SEARCH_ACCESS",
        ip: "127.0.0.1",
        userAgent: "unknown",
        path: "/api/assessments",
        method: "GET",
        detail: "Missing token",
      });
    });

    it("prefers x-forwarded-for header over req.ip", () => {
      const req = makeReq({
        headers: { "x-forwarded-for": "203.0.113.42, 10.0.0.1" },
      });
      logSecurityEvent("UNAUTHORIZED_SEARCH_ACCESS", "Test", req);

      const logObj = mockWarn.mock.calls[0][0];
      expect(logObj.securityEvent.ip).toBe("203.0.113.42, 10.0.0.1");
    });

    it("falls back to req.ip when x-forwarded-for is not present", () => {
      const req = makeReq({ ip: "10.0.0.5" });
      logSecurityEvent("UNAUTHORIZED_SEARCH_ACCESS", "Test", req);

      const logObj = mockWarn.mock.calls[0][0];
      expect(logObj.securityEvent.ip).toBe("10.0.0.5");
    });

    it("extracts userAgent from req.headers", () => {
      const req = makeReq({
        headers: { "user-agent": "Mozilla/5.0 (Test Browser)" },
      });
      logSecurityEvent("UNAUTHORIZED_SEARCH_ACCESS", "Test", req);

      const logObj = mockWarn.mock.calls[0][0];
      expect(logObj.securityEvent.userAgent).toBe("Mozilla/5.0 (Test Browser)");
    });

    it("includes matchedPattern when provided in extra", () => {
      const req = makeReq();
      logSecurityEvent(
        "SQL_INJECTION_ATTEMPT",
        "Suspicious query pattern",
        req,
        { matchedPattern: "OR 1=1 pattern" }
      );

      const logObj = mockWarn.mock.calls[0][0];
      expect(logObj.securityEvent.matchedPattern).toBe("OR 1=1 pattern");
    });

    it("includes userId when provided in extra", () => {
      const req = makeReq();
      logSecurityEvent(
        "UNAUTHORIZED_SEARCH_ACCESS",
        "Suspicious query",
        req,
        { userId: "user-42" }
      );

      const logObj = mockWarn.mock.calls[0][0];
      expect(logObj.securityEvent.userId).toBe("user-42");
    });

    it("calls logger.warn with securityEvent key", () => {
      const req = makeReq();
      logSecurityEvent("SQL_INJECTION_ATTEMPT", "Attempted injection", req);

      expect(mockWarn).toHaveBeenCalledTimes(1);
      const [logObj] = mockWarn.mock.calls[0];
      expect(logObj).toHaveProperty("securityEvent");
    });
  });

  describe("sanitizeDatabaseError", () => {
    it("returns 409 for unique_violation (23505)", () => {
      const result = sanitizeDatabaseError({ code: "23505", message: "duplicate key" });
      expect(result.statusCode).toBe(409);
      expect(result.message).toBe("A record with this information already exists.");
    });

    it("returns 400 for foreign_key_violation (23503)", () => {
      const result = sanitizeDatabaseError({ code: "23503", message: "fk violation" });
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe("Invalid reference in the submitted data.");
    });

    it("returns 400 for not_null_violation (23502)", () => {
      const result = sanitizeDatabaseError({ code: "23502", message: "null value" });
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe("A required field is missing.");
    });

    it("returns 400 for invalid_text_representation (22P02)", () => {
      const result = sanitizeDatabaseError({ code: "22P02", message: "invalid input" });
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe("Invalid data format.");
    });

    it("returns 500 for undefined_table (42P01) and logs error", () => {
      const result = sanitizeDatabaseError({ code: "42P01", message: "missing table" });
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe("An unexpected error occurred.");
      expect(mockError).toHaveBeenCalled();
    });

    it("returns 500 for undefined_column (42703) and logs error", () => {
      const result = sanitizeDatabaseError({ code: "42703", message: "missing column" });
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe("An unexpected error occurred.");
      expect(mockError).toHaveBeenCalled();
    });

    it("returns 500 for syntax_error (42601) and logs error", () => {
      const result = sanitizeDatabaseError({ code: "42601", message: "syntax error" });
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe("An unexpected error occurred.");
      expect(mockError).toHaveBeenCalled();
    });

    it("returns 500 for unknown error codes", () => {
      const result = sanitizeDatabaseError({ code: "99999" });
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe("An unexpected error occurred.");
    });

    it("returns 500 for non-object errors", () => {
      const result = sanitizeDatabaseError("not an object");
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe("An unexpected error occurred.");
    });

    it("returns 500 for objects without code property", () => {
      const result = sanitizeDatabaseError({ message: "some error", count: 5 });
      expect(result.statusCode).toBe(500);
      expect(result.message).toBe("An unexpected error occurred.");
    });
  });
});
