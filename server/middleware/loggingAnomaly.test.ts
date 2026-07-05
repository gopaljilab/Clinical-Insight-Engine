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
  let mockReq: any;
  let mockRes: any;
  let mockNext: ReturnType<typeof vi.fn>;
  let finishHandler: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    finishHandler = null;

    mockReq = {
      method: "GET",
      path: "/api/assessments",
      ip: "127.0.0.1",
    };

    mockRes = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "finish") {
          finishHandler = cb;
        }
        return mockRes;
      }),
    };

    mockNext = vi.fn();
  });

  it("calls next immediately", () => {
    loggingAnomalyMiddleware(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("registers a finish listener on the response", () => {
    loggingAnomalyMiddleware(mockReq, mockRes, mockNext);
    expect(mockRes.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("logs request data when response finishes with 200", () => {
    loggingAnomalyMiddleware(mockReq, mockRes, mockNext);
    mockRes.statusCode = 200;

    finishHandler!();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(String),
        method: "GET",
        path: "/api/assessments",
        status: 200,
        durationMs: expect.any(Number),
        ip: "127.0.0.1",
      }),
      "Request logged (Anomaly Middleware)"
    );
  });

  it("logs warning when duration exceeds 500ms", () => {
    const start = Date.now();
    mockReq.path = "/slow-endpoint";

    loggingAnomalyMiddleware(mockReq, mockRes, mockNext);
    mockRes.statusCode = 200;

    // Simulate slow response by advancing time
    const originalNow = Date.now;
    Date.now = vi.fn(() => start + 600);

    finishHandler!();

    Date.now = originalNow;

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ anomaly: true, path: "/slow-endpoint" }),
      "High latency or server error"
    );
  });

  it("logs warning for 5xx status codes even without high latency", () => {
    loggingAnomalyMiddleware(mockReq, mockRes, mockNext);
    mockRes.statusCode = 500;

    finishHandler!();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ anomaly: true, path: "/api/assessments" }),
      "High latency or server error"
    );
  });

  it("does not log warning for 4xx status codes without high latency", () => {
    loggingAnomalyMiddleware(mockReq, mockRes, mockNext);
    mockRes.statusCode = 404;

    finishHandler!();

    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("captures the correct status code in the log", () => {
    loggingAnomalyMiddleware(mockReq, mockRes, mockNext);
    mockRes.statusCode = 403;

    finishHandler!();

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403 }),
      "Request logged (Anomaly Middleware)"
    );
  });
});
