import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// Hoist mock functions so they are available in vi.mock
const { mockInfo, mockWarn, mockError } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
}));

vi.mock("pino", () => {
  const mockPino = () => {
    return {
      info: mockInfo,
      warn: mockWarn,
      error: mockError,
    };
  };
  (mockPino as any).stdTimeFunctions = { isoTime: () => "iso-time" };
  return { default: mockPino };
});

import { requestIdMiddleware } from "../server/middleware/requestId";
import { logger, requestContext } from "../server/logger";

describe("Request ID Middleware", () => {
  it("generates a new UUID request ID and attaches it to request and response headers", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/test", (req, res) => {
      res.json({ id: (req as any).id });
    });

    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.header).toHaveProperty("x-request-id");
    expect(res.body.id).toBe(res.header["x-request-id"]);
    expect(res.body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("reuses an existing x-request-id header if provided in the request", async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/test", (req, res) => {
      res.json({ id: (req as any).id });
    });

    const testId = "custom-request-id-12345";
    const res = await request(app)
      .get("/test")
      .set("x-request-id", testId);

    expect(res.status).toBe(200);
    expect(res.header["x-request-id"]).toBe(testId);
    expect(res.body.id).toBe(testId);
  });
});

describe("Structured Logger with Context ID Propagation", () => {
  beforeEach(() => {
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();
  });

  it("automatically attaches the requestId from requestContext to log messages", () => {
    const mockRequestId = "test-log-request-id";

    requestContext.run(mockRequestId, () => {
      logger.info("Test message within context");
    });

    expect(mockInfo).toHaveBeenCalledWith(
      { requestId: mockRequestId },
      "Test message within context"
    );
  });

  it("gracefully merges object payloads with the requestId", () => {
    const mockRequestId = "test-object-log-request-id";
    const logPayload = { extraKey: "extraValue", someMetric: 42 };

    requestContext.run(mockRequestId, () => {
      logger.info(logPayload, "Test message with object payload");
    });

    expect(mockInfo).toHaveBeenCalledWith(
      { requestId: mockRequestId, extraKey: "extraValue", someMetric: 42 },
      "Test message with object payload"
    );
  });
});
