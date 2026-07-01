import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock pino before any module that uses it is loaded
vi.mock("pino", () => {
  const mockInfo = vi.fn();
  const mockWarn = vi.fn();
  const mockError = vi.fn();
  return {
    default: Object.assign(
      () => ({
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
        child: () => ({ info: mockInfo, warn: mockWarn, error: mockError, child: vi.fn() }),
      }),
      { stdTimeFunctions: { isoTime: () => "iso-time" } }
    ),
  };
});

// Access the mock function after the module is loaded
import { loggingAnomalyMiddleware } from "./loggingAnomaly";
import pino from "pino";

const getMockLogger = () => (vi.mocked(pino) as any)();

function mockResponse() {
  let finishListeners: Array<() => void> = [];
  let statusCode = 200;

  const res = {
    get statusCode() { return statusCode; },
    set statusCode(code: number) { statusCode = code; },
    on(event: string, fn: () => void) {
      if (event === "finish") finishListeners.push(fn);
      return res;
    },
    emit(event: string) {
      if (event === "finish") finishListeners.forEach(fn => fn());
    },
  } as unknown as Response;

  (res as any).status = function(code: number) {
    statusCode = code;
    return this;
  };

  return {
    res,
    finishListeners,
    emitFinish: () => finishListeners.forEach(fn => fn()),
  };
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "GET",
    path: "/api/test",
    ip: "127.0.0.1",
    ...overrides,
  } as Request;
}

describe("loggingAnomalyMiddleware", () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  it("calls next() immediately without blocking the request", () => {
    const { res } = mockResponse();
    const req = mockRequest();
    loggingAnomalyMiddleware(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("logs request metadata on finish with correct method, path, status and ip", () => {
    const { res, emitFinish } = mockResponse();
    const req = mockRequest({ method: "POST", path: "/api/assessments", ip: "10.0.0.1" });

    loggingAnomalyMiddleware(req, res, mockNext);
    emitFinish();

    const mockLogger = getMockLogger();
    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    const [logData, message] = mockLogger.info.mock.calls[0];
    expect(message).toBe("Request logged (Anomaly Middleware)");
    expect(logData.method).toBe("POST");
    expect(logData.path).toBe("/api/assessments");
    expect(logData.status).toBe(200);
    expect(logData.ip).toBe("10.0.0.1");
    expect(typeof logData.durationMs).toBe("number");
    expect(logData.timestamp).toBeDefined();
  });

  it("flags high-latency anomaly when duration exceeds 500ms", () => {
    const { res } = mockResponse();
    const req = mockRequest({ path: "/api/slow" });

    // Set Date.now to 0 so startTime=0, then advance to 600 so duration=600
    const originalNow = Date.now.bind(globalThis);
    (globalThis as any).Date.now = () => 0;
    loggingAnomalyMiddleware(req, res, mockNext);
    (globalThis as any).Date.now = () => 600;
    res.emit("finish");
    (globalThis as any).Date.now = originalNow;

    const mockLogger = getMockLogger();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    const [logData, message] = mockLogger.warn.mock.calls[0];
    expect(logData.anomaly).toBe(true);
    expect(logData.path).toBe("/api/slow");
    expect(message).toBe("High latency or server error");
  });

  it("flags server-error anomaly when status is >= 500", () => {
    const { res } = mockResponse();
    const req = mockRequest({ path: "/api/error" });

    loggingAnomalyMiddleware(req, res, mockNext);
    (res as any).statusCode = 500;
    res.emit("finish");

    const mockLogger = getMockLogger();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    const [logData, message] = mockLogger.warn.mock.calls[0];
    expect(logData.anomaly).toBe(true);
    expect(logData.path).toBe("/api/error");
    expect(message).toBe("High latency or server error");
  });

  it("flags anomaly for 503 status", () => {
    const { res } = mockResponse();
    const req = mockRequest({ path: "/api/unavailable" });

    loggingAnomalyMiddleware(req, res, mockNext);
    (res as any).statusCode = 503;
    res.emit("finish");

    const mockLogger = getMockLogger();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    const [logData] = mockLogger.warn.mock.calls[0];
    expect(logData.anomaly).toBe(true);
  });

  it("does not flag anomaly for a fast 2xx response", () => {
    const { res, emitFinish } = mockResponse();
    const req = mockRequest({ path: "/api/fast" });

    loggingAnomalyMiddleware(req, res, mockNext);
    emitFinish();

    const mockLogger = getMockLogger();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
