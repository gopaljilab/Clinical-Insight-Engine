import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  logSecurityEvent,
  analyzeSearchInput,
  sanitizeDatabaseError,
} from "./sqlProtection";

const mockReq = {
  headers: {
    "x-forwarded-for": "192.168.1.1",
    "user-agent": "Mozilla/5.0 TestAgent",
  },
  ip: "127.0.0.1",
  path: "/search",
  method: "POST",
} as any;

const { mockWarn, mockError, mockInfo } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockInfo: vi.fn(),
}));

vi.mock("../logger", () => ({
  logger: {
    warn: mockWarn,
    error: mockError,
    info: mockInfo,
  },
}));

vi.mock("../validation/searchValidation", () => ({
  detectSqlInjectionPattern: vi.fn((input) => {
    const patterns = [
      "UNION", "SELECT", "DROP TABLE", "INSERT INTO", "DELETE FROM",
      "UPDATE ", "EXEC ", "'; --", "OR 1=1", "1=1",
    ];
    const upper = input.toUpperCase();
    for (const p of patterns) {
      if (upper.includes(p)) return p;
    }
    return null;
  }),
}));

describe("logSecurityEvent", () => {
  beforeEach(() => {
    mockWarn.mockReset();
  });

  it("logs security event with x-forwarded-for IP", () => {
    logSecurityEvent("SQL_INJECTION_ATTEMPT", "Suspicious input detected", mockReq);
    expect(mockWarn).toHaveBeenCalledOnce();
    const [msg, label] = mockWarn.mock.calls[0];
    expect(label).toBe("Security Event");
    const event = mockWarn.mock.calls[0][0].securityEvent;
    expect(event.type).toBe("SQL_INJECTION_ATTEMPT");
    expect(event.ip).toBe("192.168.1.1");
    expect(event.userAgent).toBe("Mozilla/5.0 TestAgent");
    expect(event.path).toBe("/search");
    expect(event.method).toBe("POST");
  });

  it("falls back to req.ip when x-forwarded-for is absent", () => {
    const reqNoProxy = { ...mockReq, headers: { "user-agent": "UA" }, ip: "10.0.0.1" } as any;
    logSecurityEvent("MALFORMED_SEARCH_QUERY", "Malformed query", reqNoProxy);
    const event = mockWarn.mock.calls[0][0].securityEvent;
    expect(event.ip).toBe("10.0.0.1");
  });

  it("includes matchedPattern when provided", () => {
    logSecurityEvent("SQL_INJECTION_ATTEMPT", "Pattern match", mockReq, { matchedPattern: "UNION SELECT" });
    const event = mockWarn.mock.calls[0][0].securityEvent;
    expect(event.matchedPattern).toBe("UNION SELECT");
  });

  it("includes userId when provided", () => {
    logSecurityEvent("UNAUTHORIZED_SEARCH_ACCESS", "No auth", mockReq, { userId: "user_123" });
    const event = mockWarn.mock.calls[0][0].securityEvent;
    expect(event.userId).toBe("user_123");
  });

  it("handles missing user-agent gracefully", () => {
    const reqNoUA = { ...mockReq, headers: {} } as any;
    logSecurityEvent("RATE_LIMIT_EXCEEDED", "Rate limited", reqNoUA);
    const event = mockWarn.mock.calls[0][0].securityEvent;
    expect(event.userAgent).toBe("unknown");
  });
});

describe("analyzeSearchInput", () => {
  it("returns safe for plain text", () => {
    const result = analyzeSearchInput("diabetes medication");
    expect(result).toEqual({ safe: true });
  });

  it("returns safe for numbers", () => {
    const result = analyzeSearchInput("12345");
    expect(result).toEqual({ safe: true });
  });

  it("detects UNION SELECT injection", () => {
    const result = analyzeSearchInput("diabetes UNION SELECT * FROM users");
    expect(result.safe).toBe(false);
    expect(result.pattern).toBe("UNION");
  });

  it("detects OR 1=1 injection", () => {
    const result = analyzeSearchInput("' OR 1=1 --");
    expect(result.safe).toBe(false);
    expect(result.pattern).toBe("OR 1=1");
  });

  it("detects DROP TABLE injection", () => {
    const result = analyzeSearchInput("'; DROP TABLE patients; --");
    expect(result.safe).toBe(false);
    expect(result.pattern).toBe("DROP TABLE");
  });

  it("detects case-insensitively", () => {
    const result = analyzeSearchInput("union select password from admins");
    expect(result.safe).toBe(false);
  });

  it("detects INSERT INTO", () => {
    const result = analyzeSearchInput("'; INSERT INTO logs VALUES('xss'); --");
    expect(result.safe).toBe(false);
    expect(result.pattern).toBe("INSERT INTO");
  });
});

describe("sanitizeDatabaseError", () => {
  beforeEach(() => {
    mockError.mockReset();
  });

  it("maps 23505 (unique_violation) to 409", () => {
    const result = sanitizeDatabaseError({ code: "23505" });
    expect(result.statusCode).toBe(409);
    expect(result.message).toBe("A record with this information already exists.");
  });

  it("maps 23503 (foreign_key_violation) to 400", () => {
    const result = sanitizeDatabaseError({ code: "23503" });
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Invalid reference in the submitted data.");
  });

  it("maps 23502 (not_null_violation) to 400", () => {
    const result = sanitizeDatabaseError({ code: "23502" });
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("A required field is missing.");
  });

  it("maps 22P02 (invalid_text_representation) to 400", () => {
    const result = sanitizeDatabaseError({ code: "22P02" });
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe("Invalid data format.");
  });

  it("maps 42P01 (undefined_table) to 500 with log", () => {
    const result = sanitizeDatabaseError({ code: "42P01" });
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("An unexpected error occurred.");
    expect(mockError).toHaveBeenCalledOnce();
  });

  it("maps 42703 (undefined_column) to 500 with log", () => {
    const result = sanitizeDatabaseError({ code: "42703" });
    expect(result.statusCode).toBe(500);
    expect(mockError).toHaveBeenCalledOnce();
  });

  it("maps 42601 (syntax_error) to 500 with log", () => {
    const result = sanitizeDatabaseError({ code: "42601" });
    expect(result.statusCode).toBe(500);
    expect(mockError).toHaveBeenCalledOnce();
  });

  it("maps unknown error code to 500 generic message", () => {
    const result = sanitizeDatabaseError({ code: "99999" });
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("An unexpected error occurred.");
  });

  it("handles plain Error object without code", () => {
    const result = sanitizeDatabaseError(new Error("something went wrong"));
    expect(result.statusCode).toBe(500);
    expect(result.message).toBe("An unexpected error occurred.");
  });

  it("handles null/undefined gracefully", () => {
    expect(sanitizeDatabaseError(null).statusCode).toBe(500);
    expect(sanitizeDatabaseError(undefined).statusCode).toBe(500);
  });
});
