import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Use vi.hoisted so mock functions are accessible in hoisted vi.mock
const { mockInfo, mockWarn, mockError } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock("../logger", () => ({
  logger: {
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  },
}));

import { loggingAnomalyMiddleware } from "./loggingAnomaly";

describe("loggingAnomalyMiddleware", () => {
  beforeEach(() => {
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
  });

  function createMockRequest(overrides: Partial<Request> = {}): Request {
    return {
      method: "GET",
      path: "/api/test",
      ip: "127.0.0.1",
      ...overrides,
    } as unknown as Request;
  }

  function createMockResponse(statusCode = 200): Response {
    const finishCallbacks: Function[] = [];
    return {
      statusCode,
      on: vi.fn((event: string, cb: Function) => {
        if (event === "finish") {
          finishCallbacks.push(cb);
        }
      }),
      _fireFinish: () => finishCallbacks.forEach((cb) => cb()),
    } as unknown as Response;
  }

  it("calls next() immediately", () => {
    const mockNext = vi.fn();
    const mockReq = createMockRequest();
    const mockRes = createMockResponse();

    loggingAnomalyMiddleware(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("logs request on finish with method, path, status, and duration", () => {
    const mockReq = createMockRequest();
    const mockRes = createMockResponse(200);

    loggingAnomalyMiddleware(mockReq, mockRes, vi.fn());

    (mockRes as any)._fireFinish();

    expect(mockInfo).toHaveBeenCalledTimes(1);
    const infoCall = mockInfo.mock.calls[0];
    const logData = infoCall[0];
    expect(logData.method).toBe("GET");
    expect(logData.path).toBe("/api/test");
    expect(logData.status).toBe(200);
    expect(typeof logData.durationMs).toBe("number");
    expect(logData.ip).toBe("127.0.0.1");
    expect(infoCall[1]).toBe("Request logged (Anomaly Middleware)");
  });

  it("logs anomaly=true when duration exceeds 500ms", () => {
    vi.useFakeTimers();
    const mockReq = createMockRequest();
    const mockRes = createMockResponse(200);

    loggingAnomalyMiddleware(mockReq, mockRes, vi.fn());

    // Advance time by 600ms before finish
    vi.advanceTimersByTime(600);
    (mockRes as any)._fireFinish();

    expect(mockWarn).toHaveBeenCalledTimes(1);
    const warnCall = mockWarn.mock.calls[0];
    expect(warnCall[0].anomaly).toBe(true);
    expect(warnCall[0].path).toBe("/api/test");
    expect(warnCall[1]).toBe("High latency or server error");

    vi.useRealTimers();
  });

  it("logs anomaly=true when status code is 500 or above", () => {
    const mockReq = createMockRequest();
    const mockRes = createMockResponse(500);

    loggingAnomalyMiddleware(mockReq, mockRes, vi.fn());
    (mockRes as any)._fireFinish();

    expect(mockWarn).toHaveBeenCalledTimes(1);
    const warnCall = mockWarn.mock.calls[0];
    expect(warnCall[0].anomaly).toBe(true);
    expect(warnCall[0].path).toBe("/api/test");
  });

  it("logs anomaly=true when status code is 503", () => {
    const mockReq = createMockRequest();
    const mockRes = createMockResponse(503);

    loggingAnomalyMiddleware(mockReq, mockRes, vi.fn());
    (mockRes as any)._fireFinish();

    expect(mockWarn).toHaveBeenCalledTimes(1);
    const warnCall = mockWarn.mock.calls[0];
    expect(warnCall[0].anomaly).toBe(true);
  });

  it("does not log anomaly for status 499 (below threshold)", () => {
    const mockReq = createMockRequest();
    const mockRes = createMockResponse(499);

    loggingAnomalyMiddleware(mockReq, mockRes, vi.fn());
    (mockRes as any)._fireFinish();

    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockInfo).toHaveBeenCalled(); // Normal request log still fires
  });

  it("captures correct status code from response", () => {
    const mockReq = createMockRequest();
    const mockRes = createMockResponse(404);

    loggingAnomalyMiddleware(mockReq, mockRes, vi.fn());
    (mockRes as any)._fireFinish();

    const infoCall = mockInfo.mock.calls[0];
    expect(infoCall[0].status).toBe(404);
  });
});
