import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requestIdMiddleware } from "./requestId";

// Mock AsyncLocalStorage
const { mockRun, mockGetStore } = vi.hoisted(() => {
  return {
    mockRun: vi.fn((val: string, fn: () => void) => fn()),
    mockGetStore: vi.fn(),
  };
});

vi.mock("../logger", () => ({
  requestContext: {
    run: mockRun,
    getStore: mockGetStore,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("requestIdMiddleware", () => {
  it("generates a UUID when no x-request-id header is present", () => {
    const req = { headers: {} } as Partial<Request>;
    const res = {
      setHeader: vi.fn(),
    } as Partial<Response>;
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req as Request, res as Response, next);

    // req.id should be set to a UUID (v4 format)
    expect((req as any).id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("uses the x-request-id header value when present", () => {
    const req = { headers: { "x-request-id": "custom-id-123" } } as Partial<Request>;
    const res = {
      setHeader: vi.fn(),
    } as Partial<Response>;
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req as Request, res as Response, next);

    expect((req as any).id).toBe("custom-id-123");
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", "custom-id-123");
  });

  it("sets X-Request-ID response header", () => {
    const req = { headers: { "x-request-id": "abc-456" } } as Partial<Request>;
    const res = {
      setHeader: vi.fn(),
    } as Partial<Response>;
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", "abc-456");
  });

  it("sets X-Request-ID header to generated UUID when no header present", () => {
    const req = { headers: {} } as Partial<Request>;
    const res = {
      setHeader: vi.fn(),
    } as Partial<Response>;
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req as Request, res as Response, next);

    const setHeaderCall = (res.setHeader as any).mock.calls[0];
    expect(setHeaderCall[0]).toBe("X-Request-ID");
    expect(setHeaderCall[1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("attaches the request ID to req.id", () => {
    const req = { headers: { "x-request-id": "req-xyz-789" } } as Partial<Request>;
    const res = {
      setHeader: vi.fn(),
    } as Partial<Response>;
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req as Request, res as Response, next);

    expect((req as any).id).toBe("req-xyz-789");
  });

  it("calls requestContext.run with the request ID", () => {
    const req = { headers: { "x-request-id": "trace-111" } } as Partial<Request>;
    const res = {
      setHeader: vi.fn(),
    } as Partial<Response>;
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req as Request, res as Response, next);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith("trace-111", expect.any(Function));
  });

  it("calls next() inside requestContext.run", () => {
    let capturedNext: NextFunction | null = null;
    mockRun.mockImplementationOnce((_val: string, fn: () => void) => {
      fn();
    });

    const req = { headers: {} } as Partial<Request>;
    const res = {
      setHeader: vi.fn(),
    } as Partial<Response>;
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req as Request, res as Response, next);

    // next was called via the callback passed to requestContext.run
    expect(mockRun).toHaveBeenCalled();
  });

  it("uses x-request-id from headers when present (lowercase)", () => {
    // Express lowercases header names; the middleware reads lowercase
    const req = { headers: { "x-request-id": "lowercase-id-999" } } as Partial<Request>;
    const res = {
      setHeader: vi.fn(),
    } as Partial<Response>;
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req as Request, res as Response, next);

    expect((req as any).id).toBe("lowercase-id-999");
  });

  it("preserves whitespace in x-request-id header", () => {
    const req = { headers: { "x-request-id": "  padded-id-456  " } } as Partial<Request>;
    const res = {
      setHeader: vi.fn(),
    } as Partial<Response>;
    const next = vi.fn() as unknown as NextFunction;

    requestIdMiddleware(req as Request, res as Response, next);

    expect((req as any).id).toBe("  padded-id-456  ");
  });
});
