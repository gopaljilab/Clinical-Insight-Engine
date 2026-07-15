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
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "X-Request-ID",
      expect.any(String)
    );
  });

  it("uses existing x-request-id header when present", () => {
    mockReq.headers = { "x-request-id": "existing-id-123" };
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "X-Request-ID",
      "existing-id-123"
    );
  });

  it("generates a new UUID when x-request-id header is absent", () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    const headerCall = (
      mockRes.setHeader as ReturnType<typeof vi.fn>
    ).mock.calls.find((call) => call[0] === "X-Request-ID");
    expect(headerCall[1]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("attaches the request ID to req.id", () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect((mockReq as any).id).toBeDefined();
  });

  it("uses the same ID for setHeader and req.id", () => {
    mockReq.headers = { "x-request-id": "my-custom-id" };
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect((mockReq as any).id).toBe("my-custom-id");
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "X-Request-ID",
      "my-custom-id"
    );
  });

  it("runs next within requestContext.run", () => {
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    expect(vi.mocked(requestContext.run)).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function)
    );
  });
  it("falls back to generating a new UUID when x-request-id header is an empty string", () => {
    mockReq.headers = { "x-request-id": "" };
    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);
    const headerCall = (mockRes.setHeader as ReturnType<typeof vi.fn>).mock.calls.find(
      (call) => call[0] === "X-Request-ID"
    );
    expect(headerCall[1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(headerCall[1]).not.toBe("");
  });

  it("does not crash when x-request-id header arrives as an array (duplicate headers)", () => {
    mockReq.headers = { "x-request-id": ["first-id", "second-id"] as any };
    expect(() =>
      requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext)
    ).not.toThrow();
    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});

describe("requestIdMiddleware - client-supplied X-Request-ID validation (security)", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requestContext.run).mockImplementation(
      (id: string, fn: () => void) => fn()
    );
    mockReq = { headers: {} };
    mockRes = { setHeader: vi.fn(), statusCode: 200 };
    mockNext = vi.fn();
  });

  // Documents current behavior: no sanitization is applied to a client-supplied
  // X-Request-ID. Flagging for maintainer review — control characters could
  // enable log/header injection downstream.
  it("passes a header containing control characters straight through unsanitized", () => {
    const malicious = "id-with-\r\nSet-Cookie:evil=1";
    mockReq.headers = { "x-request-id": malicious };

    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).id).toBe(malicious);
    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Request-ID", malicious);
  });

  // Documents current behavior: no length cap is enforced on a client-supplied
  // X-Request-ID. Flagging for maintainer review — unbounded values get
  // reflected into every log line for the request.
  it("passes an excessively long header value straight through with no length cap", () => {
    const oversized = "a".repeat(10000);
    mockReq.headers = { "x-request-id": oversized };

    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).id).toHaveLength(10000);
    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Request-ID", oversized);
  });

  // Documents current behavior: no format/charset validation (e.g. UUID shape)
  // is enforced on a client-supplied X-Request-ID.
  it("accepts any non-empty string as a valid request id with no format check", () => {
    mockReq.headers = { "x-request-id": "!!!not-a-uuid???" };

    requestIdMiddleware(mockReq as Request, mockRes as Response, mockNext);

    expect((mockReq as any).id).toBe("!!!not-a-uuid???");
  });
});
