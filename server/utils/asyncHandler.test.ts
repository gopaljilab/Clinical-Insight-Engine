import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "./asyncHandler";

describe("asyncHandler", () => {
  it("does not call next when the handler resolves successfully", async () => {
    const nextFn = vi.fn<Parameters<NextFunction>>();
    const mockReq = {} as Request;
    const mockRes = ({
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown) as Response;

    const handler = asyncHandler(async (req, res) => {
      expect(req).toBe(mockReq);
      expect(res).toBe(mockRes);
      res.status(200).json({ ok: true });
    });

    await handler(mockReq, mockRes, nextFn);

    // asyncHandler only forwards errors via next(); successful handlers
    // send a response directly. next() should not be called on success.
    expect(nextFn).toHaveBeenCalledTimes(0);
  });

  it("passes a thrown Error to next", async () => {
    const nextFn = vi.fn<Parameters<NextFunction>>();
    const mockReq = {} as Request;
    const mockRes = {} as Response;
    const expectedError = new Error("async failure");

    const handler = asyncHandler(async () => {
      throw expectedError;
    });

    await handler(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalledTimes(1);
    expect(nextFn).toHaveBeenCalledWith(expectedError);
  });

  it("passes thrown non-Error values to next", async () => {
    const nextFn = vi.fn<Parameters<NextFunction>>();
    const mockReq = {} as Request;
    const mockRes = {} as Response;
    const plainErr = { code: "ERR_UNAUTHORIZED", message: "unauthorized" };

    const handler = asyncHandler(async () => {
      throw plainErr;
    });

    await handler(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalledTimes(1);
    expect(nextFn).toHaveBeenCalledWith(plainErr);
  });

  it("passes non-Error throws to next", async () => {
    const nextFn = vi.fn<Parameters<NextFunction>>();
    const mockReq = {} as Request;
    const mockRes = {} as Response;
    const plainError = { reason: "not an Error instance" };

    const handler = asyncHandler(async () => {
      throw plainError;
    });

    await handler(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalledTimes(1);
    expect(nextFn).toHaveBeenCalledWith(plainError);
  });

  it("each invocation calls next independently on rejection", async () => {
    const nextFn = vi.fn<Parameters<NextFunction>>();
    const mockReq = {} as Request;
    const mockRes = {} as Response;

    const handler = asyncHandler(async () => {
      throw new Error("error");
    });

    await handler(mockReq, mockRes, nextFn);
    expect(nextFn).toHaveBeenCalledTimes(1);

    await handler(mockReq, mockRes, nextFn);
    expect(nextFn).toHaveBeenCalledTimes(2);
  });
});
