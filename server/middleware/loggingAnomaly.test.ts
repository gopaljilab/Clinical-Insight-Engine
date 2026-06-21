import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const { loggerInfo, loggerWarn, logger } = vi.hoisted(() => {
  const info = vi.fn();
  const warn = vi.fn();
  return {
    loggerInfo: info,
    loggerWarn: warn,
    logger: { info, warn },
  };
});

vi.mock("../logger", () => ({ logger }));

import { loggingAnomalyMiddleware } from "./loggingAnomaly";

describe("loggingAnomalyMiddleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loggerInfo.mockClear();
    loggerWarn.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls next immediately", () => {
    const next = vi.fn<NextFunction>();
    const req = { method: "GET", path: "/api/test", ip: "127.0.0.1" } as Request;
    const res = {
      on: vi.fn(),
      statusCode: 200,
    } as unknown as Response;

    loggingAnomalyMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("logs request data on res.finish with method, path, status, durationMs, ip", async () => {
    const next = vi.fn<NextFunction>();
    const req = { method: "POST", path: "/api/patients", ip: "10.0.0.1" } as Request;
    let finishCb: () => void = () => {};
    const res = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "finish") finishCb = cb;
      }),
      statusCode: 201,
    } as unknown as Response;

    loggingAnomalyMiddleware(req, res, next);

    await vi.advanceTimersByTimeAsync(50);
    finishCb();

    expect(loggerInfo).toHaveBeenCalledTimes(1);
    const [logData, message] = loggerInfo.mock.calls[0];
    expect(logData.method).toBe("POST");
    expect(logData.path).toBe("/api/patients");
    expect(logData.status).toBe(201);
    expect(logData.durationMs).toBeGreaterThanOrEqual(50);
    expect(logData.ip).toBe("10.0.0.1");
    expect(message).toBe("Request logged (Anomaly Middleware)");
  });

  it("logs warning when duration exceeds 500ms", async () => {
    const next = vi.fn<NextFunction>();
    const req = { method: "GET", path: "/api/slow", ip: "127.0.0.1" } as Request;
    let finishCb: () => void = () => {};
    const res = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "finish") finishCb = cb;
      }),
      statusCode: 200,
    } as unknown as Response;

    loggingAnomalyMiddleware(req, res, next);

    await vi.advanceTimersByTimeAsync(600);
    finishCb();

    expect(loggerWarn).toHaveBeenCalledTimes(1);
    const [logData, message] = loggerWarn.mock.calls[0];
    expect(logData.anomaly).toBe(true);
    expect(message).toBe("High latency or server error");
  });

  it("logs warning when statusCode is 500 or higher", async () => {
    const next = vi.fn<NextFunction>();
    const req = { method: "GET", path: "/api/error", ip: "127.0.0.1" } as Request;
    let finishCb: () => void = () => {};
    const res = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "finish") finishCb = cb;
      }),
      statusCode: 500,
    } as unknown as Response;

    loggingAnomalyMiddleware(req, res, next);

    await vi.advanceTimersByTimeAsync(10);
    finishCb();

    expect(loggerWarn).toHaveBeenCalledTimes(1);
    const [logData] = loggerWarn.mock.calls[0];
    expect(logData.anomaly).toBe(true);
  });

  it("does not log warning for fast successful requests", async () => {
    const next = vi.fn<NextFunction>();
    const req = { method: "GET", path: "/api/fast", ip: "127.0.0.1" } as Request;
    let finishCb: () => void = () => {};
    const res = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "finish") finishCb = cb;
      }),
      statusCode: 200,
    } as unknown as Response;

    loggingAnomalyMiddleware(req, res, next);

    await vi.advanceTimersByTimeAsync(100);
    finishCb();

    expect(loggerInfo).toHaveBeenCalledTimes(1);
    expect(loggerWarn).not.toHaveBeenCalled();
  });
});
