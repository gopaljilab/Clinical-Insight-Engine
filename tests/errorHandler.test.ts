/**
 * Tests for server/middleware/errorHandler.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { globalErrorHandler } from "../server/middleware/errorHandler";
import { AppError } from "../server/utils/AppError";
import * as sqlProtection from "../server/security/sqlProtection";
import * as auditLogger from "../server/services/security/auditLogger";
import * as errorResponse from "../shared/schemas/errorResponse";

vi.mock("../server/security/sqlProtection");
vi.mock("../server/services/security/auditLogger");
vi.mock("../shared/schemas/errorResponse");
vi.mock("../server/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sqlProtection.sanitizeDatabaseError).mockReturnValue({
    statusCode: 500,
    message: "Internal server error",
  });
  vi.mocked(auditLogger.generateRequestId).mockReturnValue("mock-request-id-123");
  vi.mocked(errorResponse.createErrorResponse).mockImplementation(
    (msg: string, reqId: string) => ({ message: msg, requestId: reqId })
  );
});

const mockRes = (): Response & { headersSent: boolean } => {
  const res: Partial<Response> & { headersSent: boolean } = {
    status: vi.fn().mockReturnThis() as any,
    json: vi.fn().mockReturnThis() as any,
    headersSent: false,
  };
  return res as Response & { headersSent: boolean };
};

const mockReq = (): Request =>
  ({
    method: "GET",
    originalUrl: "/api/patients",
    body: { name: "test" },
  } as Request);

describe("globalErrorHandler", () => {
  it("returns 500 for generic Error without leaking details", () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error("SQL syntax error near DROP TABLE");

    globalErrorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "An internal server error occurred",
        requestId: "mock-request-id-123",
      })
    );
  });

  it("preserves AppError status and message", () => {
    const req = mockReq();
    const res = mockRes();
    const err = new AppError("Patient not found", 404);

    globalErrorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Patient not found",
        requestId: "mock-request-id-123",
      })
    );
  });

  it("returns 403 for CORS missing origin error", () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error("CORS: Origin header is required");

    globalErrorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "CORS: Origin header is required",
    });
  });

  it("returns 403 for disallowed CORS origin error", () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error("Not allowed by CORS");

    globalErrorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Not allowed by CORS",
    });
  });

  it("calls next instead of sending response when headersSent is true", () => {
    const req = mockReq();
    const res = mockRes();
    res.headersSent = true;
    const err = new Error("some error");
    const next = vi.fn();

    globalErrorHandler(err, req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(err);
  });

  it("records audit event on unhandled error", () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error("Unhandled");

    globalErrorHandler(err, req, res, vi.fn());

    expect(auditLogger.logAuditEvent).toHaveBeenCalledWith(
      "Unhandled API Exception",
      expect.objectContaining({
        requestId: "mock-request-id-123",
        method: "GET",
        path: "/api/patients",
      }),
      err
    );
  });

  it("uses err.statusCode when available", () => {
    const req = mockReq();
    const res = mockRes();
    const err = new Error("Rate limited") as any;
    err.statusCode = 429;

    globalErrorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(429);
  });
});
