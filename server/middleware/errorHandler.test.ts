import { describe, expect, it, vi, beforeEach } from "vitest";
import { globalErrorHandler } from "./errorHandler";
import { AppError } from "../utils/AppError";
import type { Request, Response, NextFunction } from "express";

// --- Mock dependencies ---
const mockSanitizeDatabaseError = vi.hoisted(() =>
  vi.fn((err: unknown) => ({
    statusCode: 500,
    message: "Database error occurred",
  }))
);

const mockLogAuditEvent = vi.hoisted(() => vi.fn());

const mockGenerateRequestId = vi.hoisted(() => vi.fn(() => "req-uuid-1234"));

vi.mock("../security/sqlProtection", () => ({
  sanitizeDatabaseError: mockSanitizeDatabaseError,
}));

vi.mock("../services/security/auditLogger", () => ({
  logAuditEvent: mockLogAuditEvent,
  generateRequestId: mockGenerateRequestId,
}));

vi.mock("../../shared/schemas/errorResponse", () => ({
  createErrorResponse: (message: string, requestId: string) => ({
    message,
    requestId,
  }),
  errorResponseSchema: {},
}));

// Mock the logger
vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// --- Helpers ---
function makeReq(overrides = {}) {
  return {
    method: "POST",
    originalUrl: "/api/test",
    body: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(overrides = {}) {
  const res: any = {
    headersSent: false,
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
    on(event: string, cb: () => void) {
      return this;
    },
    ...overrides,
  };
  return res;
}

function makeNext() {
  return vi.fn() as NextFunction;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("globalErrorHandler", () => {
  it("returns 403 for CORS origin-required error", () => {
    const err = new Error("CORS: Origin header is required");
    const req = makeReq({ method: "GET", originalUrl: "/api/data" });
    const res = makeRes();
    const next = makeNext();

    globalErrorHandler(err, req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ message: "CORS: Origin header is required" });
  });

  it("returns 403 for CORS disallowed-origin error", () => {
    const err = new Error("Not allowed by CORS");
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    globalErrorHandler(err, req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ message: "Not allowed by CORS" });
  });

  it("uses AppError statusCode when err is AppError", () => {
    const err = new AppError("Custom error", 422);
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    globalErrorHandler(err, req, res, next);

    expect(res.statusCode).toBe(422);
    expect(res.body.message).toBe("Custom error");
  });

  it("uses AppError message for AppError instances", () => {
    const err = new AppError("Validation failed for input", 400);
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    globalErrorHandler(err, req, res, next);

    expect(res.body.message).toBe("Validation failed for input");
  });

  it("uses sanitizeDatabaseError for unknown errors", () => {
    const err = new Error("Postgres syntax error");
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    globalErrorHandler(err, req, res, next);

    expect(mockSanitizeDatabaseError).toHaveBeenCalledWith(err);
  });

  it("returns 500 with generic message for unhandled 500 errors", () => {
    const err = new Error("Internal server secret");
    mockSanitizeDatabaseError.mockReturnValueOnce({
      statusCode: 500,
      message: "Database error detail leaked",
    });
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    globalErrorHandler(err, req, res, next);

    // Generic 500 should not leak internal message
    expect(res.body.message).toBe("An internal server error occurred");
  });

  it("uses err.status when available", () => {
    const err = new Error("Some error") as any;
    err.status = 418;
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    globalErrorHandler(err, req, res, next);

    expect(res.statusCode).toBe(418);
  });

  it("uses err.statusCode when available", () => {
    const err = new Error("Some error") as any;
    err.statusCode = 503;
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    globalErrorHandler(err, req, res, next);

    expect(res.statusCode).toBe(503);
  });

  it("calls logAuditEvent with error details", () => {
    const err = new Error("Unhandled exception");
    const req = makeReq({ method: "DELETE", originalUrl: "/api/patients/5" });
    const res = makeRes();
    const next = makeNext();

    globalErrorHandler(err, req, res, next);

    expect(mockLogAuditEvent).toHaveBeenCalledOnce();
    const call = mockLogAuditEvent.mock.calls[0];
    expect(call[0]).toBe("Unhandled API Exception");
    expect(call[1].method).toBe("DELETE");
    expect(call[1].path).toBe("/api/patients/5");
  });

  it("returns standardized error response with requestId", () => {
    const err = new Error("Unhandled");
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    globalErrorHandler(err, req, res, next);

    expect(res.body.message).toBeDefined();
    expect(res.body.requestId).toBe("req-uuid-1234");
  });

  it("returns early if headers already sent", () => {
    const err = new Error("Too late");
    const req = makeReq();
    const res = makeRes({ headersSent: true });
    const next = makeNext();

    globalErrorHandler(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.statusCode).toBe(200); // unchanged
  });
});
