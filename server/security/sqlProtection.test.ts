import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock pino before importing the module under test
vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import {
  analyzeSearchInput,
  sanitizeDatabaseError,
} from "./sqlProtection";

const mockReq = (overrides) =>
  ({
    headers: {
      "x-forwarded-for": "192.168.1.1",
      "user-agent": "Mozilla/5.0 TestBrowser",
    },
    ip: "10.0.0.5",
    path: "/api/search",
    method: "POST",
    ...overrides,
  });

describe("analyzeSearchInput", () => {
  it("returns safe:true for normal search queries", () => {
    expect(analyzeSearchInput("diabetes symptoms")).toEqual({ safe: true });
    expect(analyzeSearchInput("patient John Doe")).toEqual({ safe: true });
    expect(analyzeSearchInput("")).toEqual({ safe: true });
  });

  it("returns safe:false with pattern for SQL injection attempts", () => {
    const result = analyzeSearchInput("' OR '1'='1");
    expect(result).toMatchObject({ safe: false, pattern: expect.any(String) });
  });

  it("detects UNION-based injection patterns", () => {
    const result = analyzeSearchInput(
      "diabetes UNION SELECT password FROM users--",
    );
    expect(result.safe).toBe(false);
  });

  it("detects comment-terminated injection", () => {
    const result = analyzeSearchInput("admin'--");
    expect(result.safe).toBe(false);
  });
});

describe("sanitizeDatabaseError", () => {
  it("maps 23505 unique_violation to 409 Conflict", () => {
    const result = sanitizeDatabaseError({ code: "23505", message: "duplicate key" });
    expect(result.statusCode).toBe(409);
    expect(result.message).toBe("A record with this information already exists.");
  });

  it("maps 23503 foreign_key_violation to 400", () => {
    const result = sanitizeDatabaseError({ code: "23503" });
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Invalid reference in the submitted data.");
  });

  it("maps 23502 not_null_violation to 400", () => {
    const result = sanitizeDatabaseError({ code: "23502" });
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("A required field is missing.");
  });

  it("maps 22P02 invalid_text_representation to 400", () => {
    const result = sanitizeDatabaseError({ code: "22P02" });
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Invalid data format.");
  });

  it("maps schema errors to 500 without leaking details", () => {
    const result = sanitizeDatabaseError({ code: "42P01" });
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("An unexpected error occurred.");
  });

  it("maps 42703 undefined_column to 500", () => {
    const result = sanitizeDatabaseError({ code: "42703" });
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("An unexpected error occurred.");
  });

  it("maps 42601 syntax_error to 500", () => {
    const result = sanitizeDatabaseError({ code: "42601" });
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("An unexpected error occurred.");
  });

  it("maps unknown codes to 500 with generic message", () => {
    const result = sanitizeDatabaseError({ code: "99999" });
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("An unexpected error occurred.");
  });

  it("returns 500 for non-object errors", () => {
    const result = sanitizeDatabaseError("something went wrong");
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("An unexpected error occurred.");
  });

  it("returns 500 for null", () => {
    const result = sanitizeDatabaseError(null);
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("An unexpected error occurred.");
  });
});

describe("logSecurityEvent", () => {
  // Import logger after mock is set up
  let warnSpy;

  beforeEach(async () => {
    vi.resetModules();
    // Re-import to get fresh mock
    const { logger } = await import("../logger");
    warnSpy = logger.warn;
    warnSpy.mockClear();
  });

  it("calls logger.warn with a structured event object", async () => {
    const { logSecurityEvent: log } = await import("./sqlProtection");
    log("SQL_INJECTION_ATTEMPT", "Injection blocked", mockReq());
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const call = warnSpy.mock.calls[0];
    expect(call[1]).toBe("Security Event");
    expect(call[0].securityEvent).toBeDefined();
  });

  it("extracts IP from x-forwarded-for header", async () => {
    const { logSecurityEvent: log } = await import("./sqlProtection");
    log("SUSPICIOUS_SEARCH_PATTERN", "Suspicious pattern", mockReq());
    const event = warnSpy.mock.calls[0][0].securityEvent;
    expect(event.ip).toBe("192.168.1.1");
  });

  it("falls back to req.ip when x-forwarded-for is absent", async () => {
    const { logSecurityEvent: log } = await import("./sqlProtection");
    log("MALFORMED_SEARCH_QUERY", "Malformed query", mockReq({ headers: { "user-agent": "Test" } }));
    const event = warnSpy.mock.calls[0][0].securityEvent;
    expect(event.ip).toBe("10.0.0.5");
  });

  it("includes method, path, and userAgent", async () => {
    const { logSecurityEvent: log } = await import("./sqlProtection");
    log("UNAUTHORIZED_SEARCH_ACCESS", "Unauthorized", mockReq());
    const event = warnSpy.mock.calls[0][0].securityEvent;
    expect(event.method).toBe("POST");
    expect(event.path).toBe("/api/search");
    expect(event.userAgent).toBe("Mozilla/5.0 TestBrowser");
  });

  it("includes ISO timestamp", async () => {
    const { logSecurityEvent: log } = await import("./sqlProtection");
    log("RATE_LIMIT_EXCEEDED", "Rate limit", mockReq());
    const event = warnSpy.mock.calls[0][0].securityEvent;
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("attaches optional matchedPattern", async () => {
    const { logSecurityEvent: log } = await import("./sqlProtection");
    log("SQL_INJECTION_ATTEMPT", "Blocked", mockReq(), { matchedPattern: "OR injection" });
    const event = warnSpy.mock.calls[0][0].securityEvent;
    expect(event.matchedPattern).toBe("OR injection");
  });

  it("attaches optional userId", async () => {
    const { logSecurityEvent: log } = await import("./sqlProtection");
    log("RATE_LIMIT_EXCEEDED", "Rate limit", mockReq(), { userId: "user-123" });
    const event = warnSpy.mock.calls[0][0].securityEvent;
    expect(event.userId).toBe("user-123");
  });
});
