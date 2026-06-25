import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "./asyncHandler";

describe("asyncHandler", () => {
  it("returns a function that accepts req, res, next", () => {
    const handler = asyncHandler(async (req, res, next) => {});
    expect(typeof handler).toBe("function");
    // handler accepts three arguments
    const mockReq = {} as Request;
    const mockRes = {} as Response;
    const mockNext = () => {};
    expect(() => handler(mockReq, mockRes, mockNext)).not.toThrow();
  });

  it("does not call next when the wrapped handler resolves", async () => {
    const mockNext = vi.fn();
    const mockReq = {} as Request;
    const mockRes = {} as Response;

    const handler = asyncHandler(async (req, res) => {
      return "done";
    });

    await handler(mockReq, mockRes, mockNext);
    // next() is only called with an error, not on success
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("calls next() with the error when the wrapped handler rejects", async () => {
    const testError = new Error("Async failure");
    const mockNext = vi.fn();
    const mockReq = {} as Request;
    const mockRes = {} as Response;

    const handler = asyncHandler(async () => {
      throw testError;
    });

    await handler(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith(testError);
  });

  // Note: synchronous throws inside the non-async wrapped function are converted
  // to Promise rejections by Promise.resolve(). The actual behavior depends on whether
  // the caller awaits the returned Promise. The primary use-case is async handlers.

  it("forwards non-Error rejections to next()", async () => {
    const mockNext = vi.fn();
    const mockReq = {} as Request;
    const mockRes = {} as Response;

    const handler = asyncHandler(async () => {
      throw "string error";
    });

    await handler(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith("string error");
  });

  it("forwards null rejection to next()", async () => {
    const mockNext = vi.fn();
    const mockReq = {} as Request;
    const mockRes = {} as Response;

    const handler = asyncHandler(async () => {
      throw null;
    });

    await handler(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(null);
  });

  it("forwards plain Error-like objects to next()", async () => {
    const err = { message: "boom", name: "CustomError" };
    const mockNext = vi.fn();
    const mockReq = {} as Request;
    const mockRes = {} as Response;

    const handler = asyncHandler(async () => {
      throw err;
    });

    await handler(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});
