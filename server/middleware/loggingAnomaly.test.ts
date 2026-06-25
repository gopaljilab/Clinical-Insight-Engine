import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { loggingAnomalyMiddleware } from "./loggingAnomaly";
import { logger } from "../logger";

describe("loggingAnomalyMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls next() to pass control to the next middleware", () => {
    const req = { method: "GET", path: "/api/test", ip: "127.0.0.1" };
    const onFinishCb: (() => void)[] = [];
    const res = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "finish") onFinishCb.push(cb);
      }),
      removeListener: vi.fn(),
      statusCode: 200,
    };
    const next = vi.fn();

    loggingAnomalyMiddleware(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("registers a finish event listener on the response", () => {
    const req = { method: "GET", path: "/api/test", ip: "127.0.0.1" };
    const onFinishCb: (() => void)[] = [];
    const res = {
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "finish") onFinishCb.push(cb);
      }),
      removeListener: vi.fn(),
      statusCode: 200,
    };

    loggingAnomalyMiddleware(req as any, res as any, vi.fn());

    expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("logs request info when response finishes normally", () => {
    const req = { method: "POST", path: "/api/patients", ip: "10.0.0.5" };
    let finishCb: () => void = () => {};
    const res = {
      on: vi.fn((_event: string, cb: () => void) => {
        finishCb = cb;
      }),
      removeListener: vi.fn(),
      statusCode: 200,
    };
    const next = vi.fn();

    loggingAnomalyMiddleware(req as any, res as any, next);

    // Simulate response finish (synchronous, instant)
    finishCb();

    // Should log the request
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(String),
        method: "POST",
        path: "/api/patients",
        status: 200,
        durationMs: expect.any(Number),
        ip: "10.0.0.5",
      }),
      "Request logged (Anomaly Middleware)"
    );
  });

  it("logs warning when duration exceeds 500ms", () => {
    const req = { method: "GET", path: "/api/slow", ip: "127.0.0.1" };
    let finishCb: (() => void) = () => {};
    const res = {
      on: vi.fn((_event: string, cb: () => void) => {
        finishCb = cb;
      }),
      removeListener: vi.fn(),
      statusCode: 200,
    };

    // Mock Date.now to return a time 600ms later
    const startTime = 1000000;
    let mockNow = startTime;
    vi.spyOn(Date, "now").mockImplementation(() => {
      if (mockNow === startTime) {
        // First call (in middleware): return start time
        return mockNow;
      }
      // Second call (in finish handler): return 600ms later
      return mockNow + 600;
    });
    // Override Date.now after middleware records startTime
    mockNow = startTime;
    vi.spyOn(Date, "now")
      .mockImplementationOnce(() => startTime)
      .mockImplementationOnce(() => startTime + 600);

    loggingAnomalyMiddleware(req as any, res as any, vi.fn());

    finishCb();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ anomaly: true, path: "/api/slow" }),
      "High latency or server error"
    );

    vi.restoreAllMocks();
  });

  it("logs warning when status code is 500 or higher", () => {
    const req = { method: "GET", path: "/api/error", ip: "127.0.0.1" };
    let finishCb: (() => void) = () => {};
    const res = {
      on: vi.fn((_event: string, cb: () => void) => {
        finishCb = cb;
      }),
      removeListener: vi.fn(),
      statusCode: 500,
    };

    vi.spyOn(Date, "now")
      .mockImplementationOnce(() => 0)
      .mockImplementationOnce(() => 50); // fast request, but 500 status

    loggingAnomalyMiddleware(req as any, res as any, vi.fn());

    finishCb();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ anomaly: true, path: "/api/error" }),
      "High latency or server error"
    );
  });

  it("does not log anomaly warning for fast successful requests", () => {
    const req = { method: "GET", path: "/api/fast", ip: "127.0.0.1" };
    let finishCb: (() => void) = () => {};
    const res = {
      on: vi.fn((_event: string, cb: () => void) => {
        finishCb = cb;
      }),
      removeListener: vi.fn(),
      statusCode: 200,
    };

    vi.spyOn(Date, "now")
      .mockImplementationOnce(() => 0)
      .mockImplementationOnce(() => 100); // 100ms, under 500ms threshold

    loggingAnomalyMiddleware(req as any, res as any, vi.fn());

    finishCb();

    // Should log info but NOT warn for a fast successful request
    expect(logger.info).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
