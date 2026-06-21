import { describe, it, expect, vi, beforeEach } from "vitest";
import { globalErrorHandler } from "./errorHandler";
import { AppError } from "../utils/AppError";

// All mock functions must be hoisted so vi.mock factories can reference them
const mockLoggerError = vi.hoisted(() => vi.fn());
const mockSanitizeDatabaseError = vi.hoisted(() => vi.fn());
const mockLogAuditEvent = vi.hoisted(() => vi.fn());
const mockCreateErrorResponse = vi.hoisted(() => vi.fn());
const mockGenerateRequestId = vi.hoisted(() => vi.fn());

vi.mock("../logger", () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn() },
}));

vi.mock("../security/sqlProtection", () => ({
  sanitizeDatabaseError: mockSanitizeDatabaseError,
}));

vi.mock("../services/security/auditLogger", () => ({
  logAuditEvent: mockLogAuditEvent,
  generateRequestId: mockGenerateRequestId,
}));

vi.mock("../../shared/schemas/errorResponse", () => ({
  createErrorResponse: mockCreateErrorResponse,
}));

function mockReq(overrides = {}) {
  return {
    method: "GET",
    originalUrl: "/test",
    body: {},
    headers: {},
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {
    statusCode: 200,
    _status: 200,
    _body: null,
    headersSent: false,
    status(code: number) {
      this._status = code;
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this._body = body;
      return this;
    },
  };
  return res;
}

const mockNext = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockSanitizeDatabaseError.mockReturnValue({ statusCode: 500, message: "DB error" });
  mockCreateErrorResponse.mockImplementation((msg: string, reqId: string) => ({ message: msg, requestId: reqId }));
  mockGenerateRequestId.mockReturnValue("req-123");
});

describe("globalErrorHandler", () => {
  it("returns 403 for CORS origin required error", () => {
    const err = new Error("CORS: Origin header is required");
    const req = mockReq();
    const res = mockRes();

    globalErrorHandler(err, req, res, mockNext);

    expect(res._status).toBe(403);
    expect(res._body).toEqual({ message: "CORS: Origin header is required" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 403 for not allowed by CORS error", () => {
    const err = new Error("Not allowed by CORS");
    const req = mockReq();
    const res = mockRes();

    globalErrorHandler(err, req, res, mockNext);

    expect(res._status).toBe(403);
    expect(res._body).toEqual({ message: "Not allowed by CORS" });
  });

  it("calls next when headers already sent", () => {
    const err = new Error("already sent");
    const req = mockReq();
    const res = mockRes();
    res.headersSent = true;

    globalErrorHandler(err, req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith(err);
  });

  it("returns 500 for generic error with generic message", () => {
    const err = new Error("internal detail");
    const req = mockReq();
    const res = mockRes();

    globalErrorHandler(err, req, res, mockNext);

    expect(res._status).toBe(500);
    expect(res._body.message).toBe("An internal server error occurred");
    expect(mockLogAuditEvent).toHaveBeenCalled();
    expect(mockCreateErrorResponse).toHaveBeenCalled();
  });

  it("returns AppError message when err is AppError", () => {
    const err = new AppError("Bad request", 400);
    const req = mockReq();
    const res = mockRes();

    globalErrorHandler(err, req, res, mockNext);

    expect(res._status).toBe(400);
    expect(res._body.message).toBe("Bad request");
  });

  it("uses sanitized status code for database errors", () => {
    mockSanitizeDatabaseError.mockReturnValueOnce({ statusCode: 502, message: "DB sanitized" });
    const err = new Error("original SQL: DROP TABLE users");
    const req = mockReq();
    const res = mockRes();

    globalErrorHandler(err, req, res, mockNext);

    expect(res._status).toBe(502);
    expect(mockSanitizeDatabaseError).toHaveBeenCalledWith(err);
  });
});
