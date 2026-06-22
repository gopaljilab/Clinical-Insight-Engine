import { describe, expect, it, vi } from "vitest";
import { asyncHandler } from "./asyncHandler";
import type { Request, Response, NextFunction } from "express";

describe("asyncHandler", () => {
  it("does not call next when the wrapped async function resolves", async () => {
    const mockReq = {} as Request;
    const mockRes = {} as Response;
    const mockNext: NextFunction = vi.fn();
    const handler = asyncHandler(async (req, res, next) => {
      return "success";
    });

    handler(mockReq, mockRes, mockNext);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("forwards rejected promises to next", async () => {
    const mockReq = {} as Request;
    const mockRes = {} as Response;
    const mockNext = vi.fn();
    const testError = new Error("async error");
    const handler = asyncHandler(async (req, res, next) => {
      throw testError;
    });

    handler(mockReq, mockRes, mockNext);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockNext).toHaveBeenCalledWith(testError);
  });

  it("passes req, res, and next to the wrapped function", async () => {
    const mockReq = { custom: "value" } as unknown as Request;
    const mockRes = { customRes: "res" } as unknown as Response;
    const mockNext = vi.fn();
    let receivedReq: any;
    let receivedRes: any;
    let receivedNext: any;

    const handler = asyncHandler(async (req, res, next) => {
      receivedReq = req;
      receivedRes = res;
      receivedNext = next;
    });

    handler(mockReq, mockRes, mockNext);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(receivedReq).toBe(mockReq);
    expect(receivedRes).toBe(mockRes);
    expect(receivedNext).toBe(mockNext);
  });

  it("does not call next if the wrapped function resolves normally", async () => {
    const mockReq = {} as Request;
    const mockRes = {} as Response;
    const mockNext = vi.fn();

    const handler = asyncHandler(async (req, res, next) => {
      // do nothing, resolve normally
    });

    handler(mockReq, mockRes, mockNext);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(mockNext).not.toHaveBeenCalled();
  });
});
