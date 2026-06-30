import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { requestIdMiddleware } from "./requestId";
import { requestContext } from "../logger";

// --- Mock requestContext ---
vi.mock("../logger", () => ({
  requestContext: {
    run: vi.fn((_ctx: any, fn: () => void) => fn()),
  },
}));

describe("requestIdMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets X-Request-ID header on the response", () => {
    const req = {
      headers: {},
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", expect.any(String));
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("assigns a generated UUID when no X-Request-ID header is present", () => {
    const req = {
      headers: {},
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    const setHeaderCalls = vi.mocked(res.setHeader).mock.calls;
    const idCall = setHeaderCalls.find(([name]) => name === "X-Request-ID");
    expect(idCall).toBeDefined();
    const id = idCall![1] as string;
    // UUID v4 format: 8-4-4-4-12 hex digits
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("preserves existing X-Request-ID header from the client", () => {
    const existingId = "client-provided-id-12345";
    const req = {
      headers: { "x-request-id": existingId },
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith("X-Request-ID", existingId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("assigns the request ID to req.id", () => {
    const req = {
      headers: {},
      id: undefined as any,
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect((req as any).id).toBeDefined();
    expect((req as any).id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("calls requestContext.run with the request ID", () => {
    const req = {
      headers: {},
      id: undefined as any,
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    requestIdMiddleware(req, res, next);

    expect(vi.mocked(requestContext.run)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function)
    );
  });
});
