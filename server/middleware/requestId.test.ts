import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-12345"),
}));

vi.mock("../logger", () => ({
  requestContext: {
    run: vi.fn((_reqId: string, fn: () => void) => fn()),
  },
}));

import { requestIdMiddleware } from "./requestId";
import { requestContext } from "../logger";

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as Request;
}

function mockResponse() {
  const headers: Record<string, string | string[]> = {};
  return {
    res: {
      setHeader: vi.fn((key: string, value: string) => {
        headers[key] = value;
        return headers;
      }),
      get headers() { return headers; },
    } as unknown as Response,
    headers,
  };
}

describe("requestIdMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses x-request-id header value when present", () => {
    const { res, headers } = mockResponse();
    const req = mockRequest({ headers: { "x-request-id": "custom-id-abc" } });
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", "custom-id-abc");
    expect((req as any).id).toBe("custom-id-abc");
  });

  it("falls back to randomUUID when x-request-id header is absent", () => {
    const { res } = mockResponse();
    const req = mockRequest();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", "test-uuid-12345");
    expect((req as any).id).toBe("test-uuid-12345");
  });

  it("calls res.setHeader with X-Request-ID", () => {
    const { res } = mockResponse();
    const req = mockRequest();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-Request-ID",
      expect.stringMatching(/^[a-z0-9-]+$/i)
    );
  });

  it("attaches request ID to req.id", () => {
    const { res } = mockResponse();
    const req = mockRequest({ headers: { "x-request-id": "req-xyz-789" } });
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect((req as any).id).toBe("req-xyz-789");
  });

  it("calls requestContext.run with the request ID and a function", () => {
    const { res } = mockResponse();
    const req = mockRequest({ headers: { "x-request-id": "ctx-test-id" } });
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(requestContext.run).toHaveBeenCalledTimes(1);
    expect(requestContext.run).toHaveBeenCalledWith(
      "ctx-test-id",
      expect.any(Function)
    );
  });

  it("calls next() exactly once via requestContext.run", () => {
    const { res } = mockResponse();
    const req = mockRequest();
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next() exactly once when x-request-id is provided", () => {
    const { res } = mockResponse();
    const req = mockRequest({ headers: { "x-request-id": "custom-req" } });
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
