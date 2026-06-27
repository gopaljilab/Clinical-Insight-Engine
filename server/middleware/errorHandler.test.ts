import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { globalErrorHandler } from "./errorHandler";
import { sanitizeDatabaseError } from "../security/sqlProtection";
import { logAuditEvent } from "../services/security/auditLogger";
import { createErrorResponse } from "../../shared/schemas/errorResponse";

// --- Mock dependencies ---

vi.mock("../security/sqlProtection", () => ({
  sanitizeDatabaseError: vi.fn((err: unknown) => ({ statusCode: 500, message: "An unexpected error occurred." })),
}));

vi.mock("../services/security/auditLogger", () => ({
  logAuditEvent: vi.fn(),
  generateRequestId: () => "req-123-abc",
}));

vi.mock("../../shared/schemas/errorResponse", () => ({
  createErrorResponse: vi.fn((message: string, requestId: string) => ({
    message,
    requestId,
    timestamp: new Date().toISOString(),
  })),
}));

vi.mock("pino", () => {
  const mockPino = vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
  (mockPino as any).stdTimeFunctions = { isoTime: () => "iso-time" };
  return { default: mockPino };
});

// Helper to build a mock Response
function mockResponse() {
  const res = {
    statusCode: 200,
    headersSentFlag: false,
    get headersSent() { return this.headersSentFlag; },
    set headersSent(v: boolean) { this.headersSentFlag = v; },
    _status: 200,
    _body: null as any,
  } as unknown as Response;
  (res as any).status = function(code: number) { (res as any)._status = code; return this; };
  (res as any).json = function(body: any) { (res as any)._body = body; return this; };
  return res;
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  const defaults = {
    method: "GET",
    originalUrl: "/api/test",
    path: "/api/test",
    body: {},
  };
  return {
    ...defaults,
    ...overrides,
    originalUrl: overrides.originalUrl ?? overrides.path ?? defaults.originalUrl,
  } as unknown as Request;
}

describe("globalErrorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits when headers are already sent", () => {
    const req = mockRequest();
    const res = mockResponse();
    (res as any).headersSentFlag = true;
    const next = vi.fn();

    globalErrorHandler(new Error("boom"), req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(vi.mocked(logAuditEvent)).not.toHaveBeenCalled();
  });

  it("returns 403 for CORS Origin header required error", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    globalErrorHandler(
      Object.assign(new Error("CORS: Origin header is required"), { name: "Error" }),
      req,
      res,
      next
    );

    expect((res as any)._status).toBe(403);
    expect((res as any)._body).toEqual({ message: "CORS: Origin header is required" });
    expect(vi.mocked(logAuditEvent)).not.toHaveBeenCalled();
  });

  it("returns 403 for disallowed CORS origin error", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    globalErrorHandler(
      Object.assign(new Error("Not allowed by CORS"), { name: "Error" }),
      req,
      res,
      next
    );

    expect((res as any)._status).toBe(403);
    expect((res as any)._body).toEqual({ message: "Not allowed by CORS" });
  });

  it("returns correct status and safe message for AppError subclasses", async () => {
    const { AppError, ValidationError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError } =
      await import("../utils/AppError");

    const testCases = [
      { err: new AppError("generic error", 418), status: 418 },
      { err: new ValidationError("validation failed"), status: 400 },
      { err: new UnauthorizedError(), status: 401 },
      { err: new ForbiddenError(), status: 403 },
      { err: new NotFoundError(), status: 404 },
      { err: new ConflictError("conflict"), status: 409 },
    ];

    for (const { err, status } of testCases) {
      const req = mockRequest();
      const res = mockResponse();
      const next = vi.fn();

      vi.mocked(sanitizeDatabaseError).mockReturnValueOnce({ statusCode: 500, message: "default" });
      vi.mocked(createErrorResponse).mockReturnValueOnce({ message: err.message, requestId: "req-123-abc" });

      globalErrorHandler(err, req, res, next);

      expect((res as any)._status).toBe(status);
      expect((res as any)._body.message).toBe(err.message);
    }
  });

  it("masks generic 500 error message from non-AppError errors", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    vi.mocked(sanitizeDatabaseError).mockReturnValueOnce({ statusCode: 500, message: "default" });
    vi.mocked(createErrorResponse).mockReturnValueOnce({ message: "An internal server error occurred", requestId: "req-123-abc" });

    globalErrorHandler(new Error("internal secret stack trace"), req, res, next);

    expect((res as any)._status).toBe(500);
    expect((res as any)._body.message).toBe("An internal server error occurred");
    expect(vi.mocked(createErrorResponse)).toHaveBeenCalledWith(
      "An internal server error occurred",
      "req-123-abc"
    );
  });

  it("uses sanitized database error for PostgreSQL error codes", () => {
    const req = mockRequest({ method: "POST", path: "/api/assessments" });
    const res = mockResponse();
    const next = vi.fn();

    vi.mocked(sanitizeDatabaseError).mockReturnValueOnce({
      statusCode: 409,
      message: "A record with this information already exists.",
    });
    vi.mocked(createErrorResponse).mockReturnValueOnce({ message: "A record with this information already exists.", requestId: "req-123-abc" });

    globalErrorHandler(
      Object.assign(new Error("duplicate key"), { code: "23505" }),
      req,
      res,
      next
    );

    expect((res as any)._status).toBe(409);
    expect((res as any)._body.message).toBe("A record with this information already exists.");
  });

  it("calls logAuditEvent with correct security event data", () => {
    const req = mockRequest({ method: "POST", path: "/api/patients", body: { name: "John" } });
    const res = mockResponse();
    const next = vi.fn();

    vi.mocked(sanitizeDatabaseError).mockReturnValueOnce({ statusCode: 500, message: "default" });
    vi.mocked(createErrorResponse).mockReturnValueOnce({ message: "", requestId: "" });

    globalErrorHandler(new Error("boom"), req, res, next);

    expect(vi.mocked(logAuditEvent)).toHaveBeenCalledWith(
      "Unhandled API Exception",
      expect.objectContaining({
        requestId: "req-123-abc",
        method: "POST",
        path: "/api/patients",
        statusCode: 500,
        exceptionType: "Error",
      }),
      expect.any(Error)
    );
  });

  it("uses err.status or err.statusCode when present on unknown errors", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    vi.mocked(sanitizeDatabaseError).mockReturnValueOnce({ statusCode: 500, message: "default" });
    vi.mocked(createErrorResponse).mockReturnValueOnce({ message: "", requestId: "" });

    const errWithStatus = Object.assign(new Error("payment required"), {
      status: 402,
      name: "Error",
    });

    globalErrorHandler(errWithStatus, req, res, next);

    expect((res as any)._status).toBe(402);
  });
});
