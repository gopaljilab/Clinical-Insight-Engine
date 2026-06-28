import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loggingAnomalyMiddleware } from "./loggingAnomaly";

const { mockInfo, mockWarn } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock("../logger", () => ({
  logger: {
    info: mockInfo,
    warn: mockWarn,
    error: vi.fn(),
  },
}));

describe("loggingAnomalyMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * Build mock req/res and call the middleware directly.
   * Sets up res.on('finish') so the finish handler is invoked.
   */
  const callMiddleware = (
    durationMs: number,
    statusCode: number,
    method = "GET",
    path = "/test",
  ) => {
    let finishHandler: () => void;

    const mockReq = { method, path, ip: "::ffff:127.0.0.1" } as any;
    const mockRes = {
      on: (event: string, cb: () => void) => {
        if (event === "finish") finishHandler = cb;
      },
      statusCode,
      getHeader: () => "::ffff:127.0.0.1",
    } as any;

    // Mock Date.now() to control elapsed time
    const startTime = 1000;
    let dateCallCount = 0;
    vi.spyOn(Date, "now").mockImplementation(() => {
      dateCallCount++;
      return dateCallCount === 1 ? startTime : startTime + durationMs;
    });

    const next = vi.fn();
    loggingAnomalyMiddleware(mockReq, mockRes, next);

    expect(next).toHaveBeenCalledTimes(1);

    // Trigger the finish event
    finishHandler!();
  };

  it("logs at INFO level with correct metadata for a 2xx response", () => {
    callMiddleware(50, 200);

    expect(mockInfo).toHaveBeenCalledTimes(1);
    const [logData, msg] = mockInfo.mock.calls[0];
    expect(msg).toBe("Request logged (Anomaly Middleware)");
    expect(logData.method).toBe("GET");
    expect(logData.path).toBe("/test");
    expect(logData.status).toBe(200);
    expect(logData.durationMs).toBe(50);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("logs at INFO level for a 404 response", () => {
    callMiddleware(10, 404);

    expect(mockInfo).toHaveBeenCalledTimes(1);
    const [logData] = mockInfo.mock.calls[0];
    expect(logData.status).toBe(404);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("logs at WARN level when duration exceeds 500ms", () => {
    callMiddleware(600, 200);

    expect(mockWarn).toHaveBeenCalledTimes(1);
    const [logData, msg] = mockWarn.mock.calls[0];
    expect(logData.anomaly).toBe(true);
    expect(msg).toBe("High latency or server error");
    // INFO is also called on every response
    expect(mockInfo).toHaveBeenCalledTimes(1);
  });

  it("logs at WARN level for a 5xx response regardless of latency", () => {
    callMiddleware(10, 503);

    expect(mockWarn).toHaveBeenCalledTimes(1);
    const [logData, msg] = mockWarn.mock.calls[0];
    expect(logData.anomaly).toBe(true);
    expect(msg).toBe("High latency or server error");
    expect(mockInfo).toHaveBeenCalledTimes(1);
  });

  it("captures the correct HTTP method in log data", () => {
    callMiddleware(10, 200, "POST");

    const [logData] = mockInfo.mock.calls[0];
    expect(logData.method).toBe("POST");
  });

  it("captures the request path in log data", () => {
    callMiddleware(10, 200, "GET", "/api/resource/42");

    const [logData] = mockInfo.mock.calls[0];
    expect(logData.path).toBe("/api/resource/42");
  });

  it("logs INFO on finish even when duration is zero", () => {
    callMiddleware(0, 200);

    expect(mockInfo).toHaveBeenCalledTimes(1);
    const [logData] = mockInfo.mock.calls[0];
    expect(logData.durationMs).toBe(0);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("logs WARN for a 500 response", () => {
    callMiddleware(5, 500);

    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockInfo).toHaveBeenCalledTimes(1);
  });
});
