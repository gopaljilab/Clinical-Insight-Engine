import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generalLimiter,
  mlLimiter,
  adminLimiter,
  exportLimiter,
  assessmentLimiter,
  previewLimiter,
} from "./rateLimit";

function createMockReq(ip) {
  return {
    ip: ip || "127.0.0.1",
    path: "/test",
    method: "GET",
    headers: {},
    get: vi.fn(() => ip || "127.0.0.1"),
  };
}

function createMockRes() {
  return {
    setHeader: vi.fn(),
    status: vi.fn(() => ({ json: vi.fn() })),
    json: vi.fn(),
    statusCode: 200,
    getHeader: vi.fn(),
    append: vi.fn(),
    send: vi.fn(),
  };
}

describe("rateLimit middleware configurations", () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    nextFn = vi.fn();
    mockReq = createMockReq("192.168.1.100");
    mockRes = createMockRes();
  });

  describe("generalLimiter — 100 requests/minute", () => {
    it("is a function with 3 parameters (Express middleware arity)", () => {
      expect(typeof generalLimiter).toBe("function");
      expect(generalLimiter.length).toBe(3);
    });

    it("calls next for a fresh IP (first request within limit)", async () => {
      await generalLimiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it("sets RateLimit-* standard headers on the response", async () => {
      await generalLimiter(mockReq, mockRes, nextFn);
      expect(mockRes.setHeader).toHaveBeenCalled();
    });
  });

  describe("mlLimiter — 20 requests/minute", () => {
    it("is a function", () => {
      expect(typeof mlLimiter).toBe("function");
    });

    it("calls next for a fresh IP", async () => {
      await mlLimiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);
    });

    it("allows multiple requests up to the configured limit", async () => {
      for (let i = 0; i < 5; i++) {
        const req = createMockReq("192.168.1.101");
        const res = createMockRes();
        await mlLimiter(req, res, nextFn);
      }
      expect(nextFn).toHaveBeenCalledTimes(5);
    });
  });

  describe("adminLimiter — 60 requests/minute", () => {
    it("is a function", () => {
      expect(typeof adminLimiter).toBe("function");
    });

    it("calls next for a fresh IP", async () => {
      await adminLimiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("exportLimiter — 10 requests/minute", () => {
    it("is a function", () => {
      expect(typeof exportLimiter).toBe("function");
    });

    it("calls next for a fresh IP", async () => {
      await exportLimiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("assessmentLimiter — 5 requests/15 minutes", () => {
    it("is a function", () => {
      expect(typeof assessmentLimiter).toBe("function");
    });

    it("calls next for a fresh IP", async () => {
      await assessmentLimiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("previewLimiter — 10 requests/15 minutes", () => {
    it("is a function", () => {
      expect(typeof previewLimiter).toBe("function");
    });

    it("calls next for a fresh IP", async () => {
      await previewLimiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("all limiters — getKey and resetKey utilities", () => {
    it("generalLimiter has getKey function", () => {
      expect(typeof generalLimiter.getKey).toBe("function");
    });

    it("generalLimiter has resetKey function", () => {
      expect(typeof generalLimiter.resetKey).toBe("function");
    });

    it("mlLimiter has getKey and resetKey", () => {
      expect(typeof mlLimiter.getKey).toBe("function");
      expect(typeof mlLimiter.resetKey).toBe("function");
    });

    it("getKey is a function on the middleware", () => {
      expect(typeof generalLimiter.getKey).toBe("function");
    });

    it("resetKey can be called without error for a given IP", () => {
      expect(() => generalLimiter.resetKey(mockReq, mockRes)).not.toThrow();
    });
  });
});
