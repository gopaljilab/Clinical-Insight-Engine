import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { loggingAnomalyMiddleware } from "./loggingAnomaly";

// --- Mock pino logger ---
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../logger", () => ({
  logger: mockLogger,
}));

describe("loggingAnomalyMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockResponse(statusCode = 200) {
    const listeners: Record<string, Function[]> = {};
    const res = {
      statusCode,
      ip: "127.0.0.1",
      on: function(event: string, cb: Function) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
        return this;
      },
      _emitFinish: function() {
        (listeners["finish"] || []).forEach((cb) => cb());
      },
    } as unknown as Response & { _emitFinish: () => void };
    return res;
  }

  function mockRequest(overrides: Partial<Request> = {}): Request {
    return {
      method: "GET",
      path: "/api/assessments",
      ip: "127.0.0.1",
      ...overrides,
    } as unknown as Request;
  }

  it("calls next to pass control to the next middleware", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    loggingAnomalyMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("logs request metadata on finish", () => {
    const req = mockRequest({ method: "POST", path: "/api/patients" });
    const res = mockResponse(200);
    const next = vi.fn();

    loggingAnomalyMiddleware(req, res, next);
    res._emitFinish();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(String),
        method: "POST",
        path: "/api/patients",
        status: 200,
        durationMs: expect.any(Number),
        ip: "127.0.0.1",
      }),
      "Request logged (Anomaly Middleware)"
    );
  });

  it("logs a warning when response duration exceeds 500ms", () => {
    const req = mockRequest();
    const originalDateNow = Date.now;
    Date.now = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(600);
    const res = mockResponse(200);
    const next = vi.fn();

    loggingAnomalyMiddleware(req, res, next);
    res._emitFinish();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ anomaly: true, path: "/api/assessments" }),
      "High latency or server error"
    );

    Date.now = originalDateNow;
  });

  it("logs a warning when status code is >= 500", () => {
    const req = mockRequest();
    const res = mockResponse(500);
    const next = vi.fn();

    loggingAnomalyMiddleware(req, res, next);
    res._emitFinish();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ anomaly: true, path: "/api/assessments" }),
      "High latency or server error"
    );
  });

  it("does not warn for normal latency and 2xx responses", () => {
    const req = mockRequest();
    const res = mockResponse(201);
    const next = vi.fn();

    loggingAnomalyMiddleware(req, res, next);
    res._emitFinish();

    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it("does not warn for 4xx responses (client errors)", () => {
    const req = mockRequest();
    const res = mockResponse(400);
    const next = vi.fn();

    loggingAnomalyMiddleware(req, res, next);
    res._emitFinish();

    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
