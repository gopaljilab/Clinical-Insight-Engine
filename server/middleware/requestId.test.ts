import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestIdMiddleware } from "./requestId";
import { requestContext } from "../logger";
import type { Request, Response } from "express";

vi.mock("../logger", () => ({
  requestContext: {
    run: vi.fn((id: string, fn: () => void) => fn()),
    getStore: vi.fn(),
  },
}));

describe("requestIdMiddleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requestContext.run).mockImplementation(
      (id: string, fn: () => void) => fn()
    );
    vi.mocked(requestContext.getStore).mockReturnValue(undefined);

    mockReq = {
      headers: {},
    };

    mockRes = {
      setHeader: vi.fn(),
      statusCode: 200,
    };

    mockNext = vi.fn();
  });

  it("calls next", () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("sets X-Request-ID header on the response", () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Request-ID", expect.any(String));
  });

  it("uses existing x-request-id header when present", () => {
    mockReq.headers = { "x-request-id": "existing-id-123" };
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Request-ID", "existing-id-123");
  });

  it("generates a new UUID when x-request-id header is absent", () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    const headerCall = (mockRes.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === "X-Request-ID"
    );
    expect(headerCall[1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("attaches the request ID to req.id", () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect((mockReq as any).id).toBeDefined();
  });

  it("uses the same ID for setHeader and req.id", () => {
    mockReq.headers = { "x-request-id": "my-custom-id" };
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect((mockReq as any).id).toBe("my-custom-id");
    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Request-ID", "my-custom-id");
  });

  it("runs next within requestContext.run", () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect(vi.mocked(requestContext.run)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function)
    );
  });
});
