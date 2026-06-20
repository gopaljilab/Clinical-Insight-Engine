import { describe, it, expect, vi, beforeEach } from "vitest";
import { requestIdMiddleware } from "./requestId";

describe("requestIdMiddleware", () => {
  let nextFn;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    nextFn = vi.fn();
    mockReq = {
      headers: {},
    };
    mockRes = {
      setHeader: vi.fn(),
    };
  });

  it("generates a random UUID when X-Request-ID header is absent", () => {
    requestIdMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Request-ID", expect.any(String));
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const headerCall = mockRes.setHeader.mock.calls[0];
    expect(headerCall[0]).toBe("X-Request-ID");
    expect(uuidRegex.test(headerCall[1])).toBe(true);
    expect(mockReq.id).toMatch(uuidRegex);
    expect(nextFn).toHaveBeenCalled();
  });

  it("uses the X-Request-ID header value when present", () => {
    const providedId = "custom-request-id-12345";
    mockReq.headers = { "x-request-id": providedId };

    requestIdMiddleware(mockReq, mockRes, nextFn);

    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Request-ID", providedId);
    expect(mockReq.id).toBe(providedId);
    expect(nextFn).toHaveBeenCalled();
  });

  it("sets X-Request-ID on both response header and request object", () => {
    const providedId = "my-trace-id";
    mockReq.headers = { "x-request-id": providedId };

    requestIdMiddleware(mockReq, mockRes, nextFn);

    expect(mockReq.id).toBe(providedId);
    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Request-ID", providedId);
    expect(nextFn).toHaveBeenCalledTimes(1);
  });

  it("calls next to continue the middleware chain", () => {
    requestIdMiddleware(mockReq, mockRes, nextFn);

    expect(nextFn).toHaveBeenCalledTimes(1);
    expect(nextFn).toHaveBeenCalledWith();
  });
});
