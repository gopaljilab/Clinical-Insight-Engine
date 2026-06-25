import { describe, expect, it, vi, beforeEach } from "vitest";

// Use vi.hoisted to declare variables that need to be accessible in hoisted vi.mock factories
const { logger, sanitizeDbMock, logAuditEvent, generateRequestId, createErrorResponse } = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  sanitizeDbMock: vi.fn((_err: unknown) => ({ statusCode: 500, message: "Generic DB error" })),
  logAuditEvent: vi.fn(),
  generateRequestId: vi.fn(() => "test-request-id-1234"),
  createErrorResponse: vi.fn((msg: string, reqId: string) => ({ message: msg, requestId: reqId })),
}));

vi.mock("../logger", () => ({ logger }));
vi.mock("../security/sqlProtection", () => ({ sanitizeDatabaseError: sanitizeDbMock }));
vi.mock("../services/security/auditLogger", () => ({
  logAuditEvent,
  generateRequestId,
}));
vi.mock("../../shared/schemas/errorResponse", () => ({ createErrorResponse }));

import { globalErrorHandler } from "./errorHandler";
import { AppError } from "../utils/AppError";

function createMockReq() {
  return {
    method: "POST",
    originalUrl: "/api/patients",
    body: { name: "John" },
    ip: "127.0.0.1",
  };
}

function createMockRes() {
  const json = vi.fn();
  const status = vi.fn(function (this: { statusCode: number }, code: number) {
    this.statusCode = code;
    return this;
  });
  return {
    headersSent: false,
    status,
    json,
    statusCode: 200,
  };
}

describe("globalErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sanitizeDbMock.mockReturnValue({ statusCode: 500, message: "Generic DB error" });
  });

  it("passes error to next() when response headers are already sent", () => {
    const req = createMockReq();
    const res = createMockRes();
    res.headersSent = true;
    const next = vi.fn();
    const err = new Error("Something went wrong");

    globalErrorHandler(err as any, req as any, res as any, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 for CORS 'Origin header is required' error", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();
    const err = new Error("CORS: Origin header is required");

    globalErrorHandler(err as any, req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "CORS: Origin header is required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for CORS 'Not allowed by CORS' error", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();
    const err = new Error("Not allowed by CORS");

    globalErrorHandler(err as any, req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Not allowed by CORS" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns AppError statusCode and message when err is an AppError subclass", () => {
    // AppError overrides sanitizeDatabaseError's status and message
    sanitizeDbMock.mockReturnValue({ statusCode: 500, message: "DB table 'users' not found" });

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();

    const err = new AppError("Invalid input data", 400);

    globalErrorHandler(err as any, req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid input data" })
    );
    expect(createErrorResponse).toHaveBeenCalledWith(
      "Invalid input data",
      "test-request-id-1234"
    );
  });

  it("masks internal error message for non-AppError 500 errors to prevent info leakage", () => {
    sanitizeDbMock.mockReturnValue({
      statusCode: 500,
      message: "DB table 'users' not found",
    });

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();
    const err = new Error("Internal stack trace: /path/to/file.js:42");

    globalErrorHandler(err as any, req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(createErrorResponse).toHaveBeenCalledWith(
      "An internal server error occurred",
      "test-request-id-1234"
    );
  });

  it("logs error details and audit event for non-CORS errors", () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();
    const err = new Error("Unhandled exception");

    globalErrorHandler(err as any, req as any, res as any, next);

    expect(logger.error).toHaveBeenCalled();
    expect(logAuditEvent).toHaveBeenCalled();
  });

  it("uses err.status for HTTP status but returns sanitized message for non-AppError", () => {
    sanitizeDbMock.mockReturnValue({ statusCode: 500, message: "Generic DB error" });

    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn();
    const err = new Error("Too many requests");
    (err as any).status = 429;

    globalErrorHandler(err as any, req as any, res as any, next);

    // err.status determines HTTP status code
    expect(res.status).toHaveBeenCalledWith(429);
    // Non-AppError errors always use the sanitized message (info-leak prevention)
    expect(createErrorResponse).toHaveBeenCalledWith(
      "Generic DB error",
      "test-request-id-1234"
    );
  });
});
