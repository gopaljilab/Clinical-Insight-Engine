import { describe, it, expect, vi } from "vitest";
import { asyncHandler } from "./asyncHandler";

describe("asyncHandler", () => {
  it("calls the wrapped function with req, res, next", async () => {
    const mockFn = vi.fn().mockResolvedValue(undefined);
    const mockReq = {};
    const mockRes = {};
    const mockNext = vi.fn();

    const handler = asyncHandler(mockFn);
    await handler(mockReq, mockRes, mockNext);

    expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
  });

  it("does not call next when the wrapped function resolves", async () => {
    const mockFn = vi.fn().mockResolvedValue(undefined);
    const mockNext = vi.fn();

    const handler = asyncHandler(mockFn);
    await handler({}, {}, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
  });

  it("forwards rejection to next", async () => {
    const testError = new Error("async error");
    const mockFn = vi.fn().mockRejectedValue(testError);
    const mockNext = vi.fn();

    const handler = asyncHandler(mockFn);
    await handler({}, {}, mockNext);

    expect(mockNext).toHaveBeenCalledWith(testError);
  });

  it("handles non-Error rejections", async () => {
    const mockFn = vi.fn().mockRejectedValue("string error");
    const mockNext = vi.fn();

    const handler = asyncHandler(mockFn);
    await handler({}, {}, mockNext);

    expect(mockNext).toHaveBeenCalledWith("string error");
  });
});
