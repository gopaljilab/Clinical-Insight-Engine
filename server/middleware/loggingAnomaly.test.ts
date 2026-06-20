import { describe, it, expect, vi, beforeEach } from "vitest";
import { loggingAnomalyMiddleware } from "./loggingAnomaly";
import { logger } from "../logger";

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("loggingAnomalyMiddleware", () => {
  let nextFn;
  let mockReq;
  let mockRes;
  let finishHandler;

  beforeEach(() => {
    nextFn = vi.fn();
    mockReq = {
      method: "GET",
      path: "/api/test",
      ip: "127.0.0.1",
    };
    mockRes = {
      statusCode: 200,
      on: vi.fn((event, handler) => {
        if (event === "finish") {
          finishHandler = handler;
        }
      }),
    };
    logger.info.mockClear();
    logger.warn.mockClear();
  });

  it("calls next to continue the middleware chain", () => {
    loggingAnomalyMiddleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalledTimes(1);
  });

  it("registers a finish event handler on the response", () => {
    loggingAnomalyMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("logs request metadata when the response finishes normally", () => {
    loggingAnomalyMiddleware(mockReq, mockRes, nextFn);

    finishHandler.call(mockRes);

    expect(logger.info).toHaveBeenCalledTimes(1);
    const logCall = logger.info.mock.calls[0];
    const logData = logCall[0];
    const logMsg = logCall[1];
    expect(logData.method).toBe("GET");
    expect(logData.path).toBe("/api/test");
    expect(logData.status).toBe(200);
    expect(typeof logData.durationMs).toBe("number");
    expect(logData.ip).toBe("127.0.0.1");
    expect(logMsg).toBe("Request logged (Anomaly Middleware)");
  });

  it("logs an anomaly warning for responses with duration > 500ms", () => {
    const start = Date.now();
    mockReq.path = "/api/slow";
    loggingAnomalyMiddleware(mockReq, mockRes, nextFn);

    // Simulate a slow response by directly calling the finish handler
    // with a mocked Date.now
    vi.spyOn(Date, "now").mockReturnValue(start + 600);
    finishHandler.call(mockRes);
    Date.now.mockRestore();

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const warnCall = logger.warn.mock.calls[0];
    expect(warnCall[0].anomaly).toBe(true);
    expect(warnCall[0].path).toBe("/api/slow");
  });

  it("logs an anomaly warning for 5xx responses", () => {
    mockRes.statusCode = 500;
    mockReq.path = "/api/error";
    loggingAnomalyMiddleware(mockReq, mockRes, nextFn);

    finishHandler.call(mockRes);

    expect(logger.warn).toHaveBeenCalledTimes(1);
    const warnCall = logger.warn.mock.calls[0];
    expect(warnCall[0].anomaly).toBe(true);
  });

  it("does not log anomaly warning for normal responses under 500ms with 2xx status", () => {
    mockRes.statusCode = 200;
    loggingAnomalyMiddleware(mockReq, mockRes, nextFn);

    finishHandler.call(mockRes);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });
});
