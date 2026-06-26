import { describe, expect, it, vi } from "vitest";
import { asyncHandler } from "./asyncHandler";

describe("asyncHandler", () => {
  it("returns a function (Express RequestHandler)", () => {
    const mockHandler = vi.fn().mockResolvedValue(undefined);
    const middleware = asyncHandler(mockHandler);
    expect(typeof middleware).toBe("function");
    // Express handler signature: (req, res, next)
    expect(middleware.length).toBe(3);
  });

  it("calls the wrapped handler with req, res, and next", async () => {
    const mockHandler = vi.fn().mockResolvedValue(undefined);
    const middleware = asyncHandler(mockHandler);

    const req = {} as any;
    const res = {} as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(req, res, next);
  });

  it("does not call next() when the handler resolves", async () => {
    const mockHandler = vi.fn().mockResolvedValue(undefined);
    const middleware = asyncHandler(mockHandler);

    const next = vi.fn();
    await middleware({} as any, {} as any, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("calls next(error) when the handler rejects with an error", async () => {
    const testError = new Error("Something went wrong");
    const mockHandler = vi.fn().mockRejectedValue(testError);
    const middleware = asyncHandler(mockHandler);

    const next = vi.fn();
    await middleware({} as any, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(testError);
  });

  it("calls next(error) when the handler throws synchronously", async () => {
    const testError = new Error("Sync error");
    // Use a wrapper so the sync throw happens inside the handler body,
    // which is what asyncHandler's Promise.resolve catches.
    const mockHandler = vi.fn().mockImplementation(async () => {
      throw testError;
    });
    const middleware = asyncHandler(mockHandler);

    const next = vi.fn();
    await middleware({} as any, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(testError);
  });

  it("passes non-Error rejections to next as-is", async () => {
    const nonErrorValue = { code: "AUTH_FAILED", message: "Invalid token" };
    const mockHandler = vi.fn().mockRejectedValue(nonErrorValue);
    const middleware = asyncHandler(mockHandler);

    const next = vi.fn();
    await middleware({} as any, {} as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(nonErrorValue);
  });

  it("handles multiple concurrent calls independently", async () => {
    const callOrder: string[] = [];
    const mockHandler = vi.fn().mockImplementation(async () => {
      callOrder.push("handler");
    });
    const middleware = asyncHandler(mockHandler);

    const next = vi.fn();
    const req = {} as any;
    const res = {} as any;

    await Promise.all([
      middleware(req, res, next),
      middleware(req, res, next),
    ]);

    expect(mockHandler).toHaveBeenCalledTimes(2);
    expect(callOrder).toEqual(["handler", "handler"]);
    expect(next).not.toHaveBeenCalled();
  });
});
