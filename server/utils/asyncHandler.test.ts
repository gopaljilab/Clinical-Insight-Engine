import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { asyncHandler } from "./asyncHandler";
import type { Request, Response, NextFunction } from "express";

describe("asyncHandler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call next when async function resolves successfully", async () => {
    const next = vi.fn<Parameters<NextFunction>>();
    const req = {} as Request;
    const res = { json: vi.fn() } as unknown as Response;
    const handler = asyncHandler(async (_req, _res, _next) => {
      return;
    });

    const promise = handler(req, res, next);
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next with the error when async function rejects", async () => {
    const next = vi.fn<Parameters<NextFunction>>();
    const req = {} as Request;
    const res = {} as Response;
    const testError = new Error("async rejection");
    const handler = asyncHandler(async (_req, _res, _next) => {
      throw testError;
    });

    const promise = handler(req, res, next);
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(testError);
  });

  it("returns a function that is a valid request handler", () => {
    const handler = asyncHandler(async (_req, _res, _next) => {});
    expect(typeof handler).toBe("function");
    expect(handler.length).toBe(3);
  });

  it("passes request and response objects through to the wrapped function", async () => {
    const next = vi.fn<Parameters<NextFunction>>();
    const req = { method: "POST", path: "/test" } as Request;
    const res = {} as Response;
    let receivedReq: Request | undefined;
    let receivedRes: Response | undefined;

    const handler = asyncHandler(async (r, resArg, _next) => {
      receivedReq = r;
      receivedRes = resArg;
    });

    const promise = handler(req, res, next);
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    expect(receivedReq).toBe(req);
    expect(receivedRes).toBe(res);
  });
});
