import { describe, expect, it, vi } from "vitest";
import {
  generalLimiter,
  mlLimiter,
  adminLimiter,
  exportLimiter,
  assessmentLimiter,
  previewLimiter,
} from "./rateLimit";

function createMockReqRes(overrides: { ip?: string } = {}) {
  const mockApp = { get: (key: string) => (key === "trust proxy" ? false : undefined) };
  const resHeaders: Record<string, string | number> = {};
  return {
    req: {
      ip: overrides.ip ?? "127.0.0.1",
      method: "GET",
      path: "/",
      url: "/",
      headers: {},
      app: mockApp,
      socket: { remoteAddress: overrides.ip ?? "127.0.0.1" },
    },
    res: {
      setHeader: vi.fn((key: string, value: string | number) => {
        resHeaders[key] = value;
      }),
      statusCode: 200,
      status: vi.fn(function (this: { statusCode: number }, code: number) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(),
      json: vi.fn(),
      end: vi.fn(),
    },
    next: vi.fn(),
  };
}

describe("rateLimit middleware", () => {
  it("exports generalLimiter, mlLimiter, adminLimiter, exportLimiter, assessmentLimiter, previewLimiter", () => {
    const limiters = [
      generalLimiter,
      mlLimiter,
      adminLimiter,
      exportLimiter,
      assessmentLimiter,
      previewLimiter,
    ];
    limiters.forEach((limiter) => {
      expect(typeof limiter).toBe("function");
    });
  });

  it("generalLimiter is callable on first request without throwing", async () => {
    const { req, res, next } = createMockReqRes({ ip: "10.0.0.1" });
    await expect(generalLimiter(req, res, next)).resolves.not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it("rate limiter sends 429 response via res.send when limit exceeded", async () => {
    const { rateLimit } = await import("express-rate-limit");
    // Use fresh limiter with limit=1
    const limiter = rateLimit({
      windowMs: 60 * 1000,
      limit: 1,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Too many requests, please try again later." },
    });

    const ip = "10.0.1.100";
    const req1 = createMockReqRes({ ip });
    const req2 = createMockReqRes({ ip });

    await limiter(req1.req, req1.res, req1.next);
    await limiter(req2.req, req2.res, req2.next);

    // Second request should be rate-limited: res.send should be called with the message
    expect(req2.res.send).toHaveBeenCalled();
    const sendCall = (req2.res.send as ReturnType<typeof vi.fn>).mock.lastCall;
    expect(sendCall?.[0]).toEqual({ message: "Too many requests, please try again later." });
    // Status should be 429
    expect(req2.res.status).toHaveBeenCalledWith(429);
  });

  it("mlLimiter is callable on first request without throwing", async () => {
    const { req, res, next } = createMockReqRes({ ip: "10.0.2.1" });
    await expect(mlLimiter(req, res, next)).resolves.not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it("exportLimiter is callable on first request without throwing", async () => {
    const { req, res, next } = createMockReqRes({ ip: "10.0.3.1" });
    await expect(exportLimiter(req, res, next)).resolves.not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it("adminLimiter is callable on first request without throwing", async () => {
    const { req, res, next } = createMockReqRes({ ip: "10.0.4.1" });
    await expect(adminLimiter(req, res, next)).resolves.not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it("assessmentLimiter is callable on first request without throwing", async () => {
    const { req, res, next } = createMockReqRes({ ip: "10.0.5.1" });
    await expect(assessmentLimiter(req, res, next)).resolves.not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it("previewLimiter is callable on first request without throwing", async () => {
    const { req, res, next } = createMockReqRes({ ip: "10.0.6.1" });
    await expect(previewLimiter(req, res, next)).resolves.not.toThrow();
    expect(next).toHaveBeenCalled();
  });

  it("each limiter sets RateLimit-* headers on response", async () => {
    const limiters = [
      generalLimiter,
      mlLimiter,
      adminLimiter,
      exportLimiter,
      assessmentLimiter,
      previewLimiter,
    ];

    for (const limiter of limiters) {
      const { req, res, next } = createMockReqRes({ ip: `10.0.7.${Math.random()}` });
      await limiter(req, res, next);

      const headerCalls = (res.setHeader as ReturnType<typeof vi.fn>).mock.calls;
      const rateLimitHeaders = headerCalls.filter(
        ([name]: [string]) =>
          name.startsWith("RateLimit") || name.startsWith("X-RateLimit")
      );
      expect(rateLimitHeaders.length).toBeGreaterThan(0);
    }
  });
});
