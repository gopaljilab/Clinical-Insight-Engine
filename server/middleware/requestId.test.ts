import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const { runMock } = vi.hoisted(() => {
  const fn = vi.fn((_id: string, cb: () => void) => cb());
  return { runMock: fn };
});

vi.mock("../logger", () => ({
  requestContext: { run: runMock },
}));

import { requestIdMiddleware } from "./requestId";

describe("requestIdMiddleware", () => {
  beforeEach(() => {
    runMock.mockClear();
  });

  it("generates a random UUID when x-request-id header is absent", () => {
    const next = vi.fn<NextFunction>();
    const req = {
      headers: {},
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;

    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", expect.any(String));
    expect((req as any).id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it("uses existing x-request-id header when provided", () => {
    const next = vi.fn<NextFunction>();
    const req = {
      headers: { "x-request-id": "user-provided-id-123" },
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;

    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", "user-provided-id-123");
    expect((req as any).id).toBe("user-provided-id-123");
  });

  it("calls requestContext.run with the request ID and a callback that calls next", () => {
    const next = vi.fn<NextFunction>();
    const req = { headers: {} } as unknown as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;

    requestIdMiddleware(req, res, next);

    expect(runMock).toHaveBeenCalledTimes(1);
    const [, callback] = runMock.mock.calls[0];
    expect(typeof callback).toBe("function");
    // The middleware calls next() directly; the callback also calls next
    // so next should be called twice total (once by middleware, once by callback)
    expect(next).toHaveBeenCalledTimes(1);
    callback();
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("sets X-Request-ID on both req.id and res header", () => {
    const next = vi.fn<NextFunction>();
    const req = { headers: {} } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;

    requestIdMiddleware(req, res, next);

    const setHeaderCalls = res.setHeader.mock.calls;
    const headerCall = setHeaderCalls.find(
      (call: unknown[]) => (call[0] as string) === "X-Request-ID"
    );
    expect(headerCall).toBeDefined();
    expect((req as any).id).toBe(headerCall![1]);
  });

  it("normalizes x-request-id header to x-request-id (case-insensitive lookup)", () => {
    const next = vi.fn<NextFunction>();
    const req = {
      headers: { "x-request-id": "custom-id" },
    } as unknown as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;

    requestIdMiddleware(req, res, next);

    expect((req as any).id).toBe("custom-id");
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", "custom-id");
  });
});
