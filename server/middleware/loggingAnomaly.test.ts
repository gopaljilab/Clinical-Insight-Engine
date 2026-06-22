import { describe, expect, it, vi } from "vitest";
import { loggingAnomalyMiddleware } from "./loggingAnomaly";
import type { Request, Response } from "express";

describe("loggingAnomalyMiddleware", () => {
  it("calls next immediately", () => {
    const mockReq = { method: "GET", path: "/test", ip: "127.0.0.1" } as unknown as Request;
    const mockRes = {
      statusCode: 200,
      on: vi.fn(),
    } as unknown as Response;
    const mockNext = vi.fn();

    loggingAnomalyMiddleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("registers finish event listener on response", () => {
    const mockReq = { method: "GET", path: "/test", ip: "127.0.0.1" } as unknown as Request;
    const mockRes = {
      statusCode: 200,
      on: vi.fn(),
    } as unknown as Response;
    const mockNext = vi.fn();

    loggingAnomalyMiddleware(mockReq, mockRes, mockNext);

    expect(mockRes.on).toHaveBeenCalledWith("finish", expect.any(Function));
  });

  it("does not call next again from the finish listener", async () => {
    const mockReq = { method: "GET", path: "/test", ip: "127.0.0.1" } as unknown as Request;
    const mockNext = vi.fn();

    let finishCallback: () => void;
    const mockRes = {
      statusCode: 200,
      on: vi.fn((event: string, cb: () => void) => {
        if (event === "finish") {
          finishCallback = cb;
        }
      }),
    } as unknown as Response;

    loggingAnomalyMiddleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);

    // Trigger the finish event
    finishCallback!();
    // next should still only have been called once (the initial call)
    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});
