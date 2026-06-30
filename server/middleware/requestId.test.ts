import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requestIdMiddleware } from "./requestId";

// Mock requestContext (async context storage used by the logger)
vi.mock("../logger", () => ({
  requestContext: {
    run: vi.fn((_id: string, fn: () => void) => fn()),
  },
}));

function mockResponse() {
  const res = {
    _headers: {} as Record<string, string>,
    _headerSet: false,
  } as unknown as Response;
  (res as any).setHeader = function(name: string, value: string) {
    (res as any)._headers[name] = value;
    return this;
  };
  return res;
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as unknown as Request;
}

describe("requestIdMiddleware", () => {
  it("calls next()", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("sets X-Request-ID response header from incoming header", () => {
    const req = mockRequest({ headers: { "x-request-id": "req-abc-123" } as any });
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req, res, next);

    expect((res as any)._headers["X-Request-ID"]).toBe("req-abc-123");
  });

  it("sets X-Request-ID response header with generated UUID when no header present", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req, res, next);

    const id = (res as any)._headers["X-Request-ID"];
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(10); // UUID format
    // UUID v4 pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("attaches the request ID to req.id", () => {
    const req = mockRequest({ headers: { "x-request-id": "req-xyz-999" } as any });
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req, res, next);

    expect((req as any).id).toBe("req-xyz-999");
  });

  it("attaches a generated UUID to req.id when no header", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req, res, next);

    expect(typeof (req as any).id).toBe("string");
    expect((req as any).id.length).toBeGreaterThan(10);
  });

  it("uses the same ID for both req.id and X-Request-ID header", () => {
    const req = mockRequest({ headers: { "x-request-id": "shared-id-42" } as any });
    const res = mockResponse();
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req, res, next);

    expect((req as any).id).toBe("shared-id-42");
    expect((res as any)._headers["X-Request-ID"]).toBe("shared-id-42");
    expect((req as any).id).toBe((res as any)._headers["X-Request-ID"]);
  });
});
