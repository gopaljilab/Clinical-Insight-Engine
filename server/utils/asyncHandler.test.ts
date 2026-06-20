import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "./asyncHandler";

describe("asyncHandler", () => {
  it("calls the wrapped function with req, res, next", async () => {
    const mockFn = vi.fn().mockResolvedValue(undefined);
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();
    const handler = asyncHandler(mockFn);
    await handler(req, res, next);
    expect(mockFn).toHaveBeenCalledWith(req, res, next);
  });

  it("forwards rejected promise to next", async () => {
    const testError = new Error("async error");
    const mockFn = vi.fn().mockRejectedValue(testError);
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();
    const handler = asyncHandler(mockFn);
    await handler(req, res, next);
    expect(next).toHaveBeenCalledWith(testError);
  });

  it("does not call next on resolved promise", async () => {
    const mockFn = vi.fn().mockResolvedValue(undefined);
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();
    const handler = asyncHandler(mockFn);
    await handler(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns a RequestHandler function", () => {
    const fn = asyncHandler(vi.fn());
    expect(typeof fn).toBe("function");
    expect(fn.length).toBe(3); // arity of Express middleware
  });
});
