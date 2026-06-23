import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { globalErrorHandler } from "./errorHandler";
import { AppError, ValidationError, ForbiddenError, NotFoundError } from "../utils/AppError";
import { logAuditEvent } from "../services/security/auditLogger";

vi.mock("../services/security/auditLogger", () => ({
  logAuditEvent: vi.fn(),
  generateRequestId: vi.fn().mockReturnValue("00000000-0000-0000-0000-000000000001"),
}));

vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

function makeMockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: "POST",
    originalUrl: "/api/assessments",
    body: { name: "Alice" },
    ip: "127.0.0.1",
    headers: { "user-agent": "test-agent" },
    ...overrides,
  } as unknown as Request;
}

function makeMockRes(overrides: Partial<Response> = {}): Response {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    headersSent: false,
    ...overrides,
  };
  return res as unknown as Response;
}

function makeMockNext(): NextFunction {
  return vi.fn();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("globalErrorHandler", () => {
  it("returns 403 for CORS Origin header required error", () => {
    const err = new Error("CORS: Origin header is required");
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "CORS: Origin header is required" });
  });

  it("returns 403 for CORS disallowed origin error", () => {
    const err = new Error("Not allowed by CORS");
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Not allowed by CORS" });
  });

  it("calls next(err) when headersSent is true", () => {
    const err = new Error("already sent");
    const req = makeMockReq();
    const res = makeMockRes({ headersSent: true });
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("maps ValidationError (AppError subclass) to its statusCode", () => {
    const err = new ValidationError("Invalid input");
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid input" })
    );
  });

  it("maps ForbiddenError to 403 status", () => {
    const err = new ForbiddenError("Access denied");
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Access denied" })
    );
  });

  it("maps NotFoundError to 404 status", () => {
    const err = new NotFoundError("Patient not found");
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Patient not found" })
    );
  });

  it("returns safe message for generic AppError with non-500 status", () => {
    const err = new AppError("Bad request", 400);
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Bad request" }));
  });

  it("returns generic safe message for unhandled 500 errors", () => {
    const err = new Error("Database connection failed");
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "An internal server error occurred" })
    );
  });

  it("maps Postgres error code 23505 (unique_violation) to 409", () => {
    const err = { code: "23505", message: "duplicate key" } as any;
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.not.stringContaining("23505") })
    );
  });

  it("maps Postgres error code 23503 (foreign_key_violation) to 400", () => {
    const err = { code: "23503", message: "fk violation" } as any;
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("calls logAuditEvent for unhandled exceptions", () => {
    const err = new Error("boom");
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(logAuditEvent).toHaveBeenCalledWith(
      "Unhandled API Exception",
      expect.objectContaining({
        requestId: expect.any(String),
        method: "POST",
        path: "/api/assessments",
        statusCode: 500,
        exceptionType: "Error",
      }),
      err
    );
  });

  it("response includes a requestId in the error payload", () => {
    const err = new Error("boom");
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.requestId).toBeDefined();
    expect(jsonCall.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("returns 500 for an error with err.status set", () => {
    const err = new Error("boom") as any;
    err.status = 422;
    const req = makeMockReq();
    const res = makeMockRes();
    const next = makeMockNext();

    globalErrorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
  });
});
