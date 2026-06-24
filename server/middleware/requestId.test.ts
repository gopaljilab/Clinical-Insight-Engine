import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { requestIdMiddleware } from "./requestId";
import { requestContext } from "../logger";

describe("requestIdMiddleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: ReturnType<typeof vi.fn>;
  let finishListeners: Array<() => void>;

  beforeEach(() => {
    finishListeners = [];
    nextFn = vi.fn();

    mockReq = {
      headers: {},
    };

    mockRes = {
      setHeader: vi.fn((key: string, value: string) => {
        // no-op
      }),
      on: vi.fn((event: string, listener: () => void) => {
        if (event === "finish" || event === "close") {
          finishListeners.push(listener);
        }
        return mockRes as Response;
      }),
    };
  });

  it("sets X-Request-ID response header to a UUID when no header is present", () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Request-ID", expect.any(String));
    // UUID format: 8-4-4-4-12 hex characters
    const call = (mockRes.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "X-Request-ID"
    );
    const headerValue = call?.[1] as string;
    expect(headerValue).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("forwards client-supplied X-Request-ID header when present", () => {
    const clientId = "client-supplied-request-id-123";
    mockReq.headers = { "x-request-id": clientId };

    requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Request-ID", clientId);
  });

  it("attaches the request ID to req.id", () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect((mockReq as any).id).toBeDefined();
    const call = (mockRes.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "X-Request-ID"
    );
    expect((mockReq as any).id).toBe(call?.[1]);
  });

  it("calls next to continue the middleware chain", () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect(nextFn).toHaveBeenCalled();
  });

  it("runs the downstream handler within the async context keyed by the request ID", () => {
    let capturedStore: string | undefined;

    requestIdMiddleware(mockReq as Request, mockRes as Response, () => {
      capturedStore = requestContext.getStore();
    });

    expect(capturedStore).toBeDefined();
    const call = (mockRes.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "X-Request-ID"
    );
    expect(capturedStore).toBe(call?.[1]);
  });

  it("generates a fresh UUID for each request (not reused)", () => {
    const ids: string[] = [];

    const req1: Partial<Request> = { headers: {} };
    const res1: Partial<Response> = {
      setHeader: vi.fn(),
      on: vi.fn(),
    };
    requestIdMiddleware(req1 as Request, res1 as Response, () => {
      ids.push(requestContext.getStore() as string);
    });

    const req2: Partial<Request> = { headers: {} };
    const res2: Partial<Response> = {
      setHeader: vi.fn(),
      on: vi.fn(),
    };
    requestIdMiddleware(req2 as Request, res2 as Response, () => {
      ids.push(requestContext.getStore() as string);
    });

    expect(ids[0]).not.toBe(ids[1]);
  });
});
