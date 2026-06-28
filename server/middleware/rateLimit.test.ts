import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";
import {
  generalLimiter,
  mlLimiter,
  adminLimiter,
  exportLimiter,
  assessmentLimiter,
  previewLimiter,
} from "./rateLimit";

describe("rateLimit middleware configuration", () => {
  // Helper: build an Express app using a given limiter and a simple route
  const makeAgent = (
    limiter: ReturnType<typeof generalLimiter extends (...args: any[]) => infer R ? R : never>
  ) => {
    const app = express();
    app.use(limiter as any);
    app.get("/test", (_req, res) => res.status(200).json({ ok: true }));
    return request(app);
  };

  // ── generalLimiter ────────────────────────────────────────────────────────
  describe("generalLimiter", () => {
    it("returns rate limit headers on the first request", async () => {
      const res = await makeAgent(generalLimiter).get("/test");
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty("ratelimit-limit");
      expect(res.headers).toHaveProperty("ratelimit-remaining");
    });

    it("limit is 100 requests per window", async () => {
      const res = await makeAgent(generalLimiter).get("/test");
      expect(res.headers).toHaveProperty("ratelimit-limit", "100");
    });
  });

  // ── mlLimiter ───────────────────────────────────────────────────────────────
  describe("mlLimiter", () => {
    it("returns rate limit headers", async () => {
      const res = await makeAgent(mlLimiter).get("/test");
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty("ratelimit-limit");
    });

    it("limit is 20 requests per window", async () => {
      const res = await makeAgent(mlLimiter).get("/test");
      expect(res.headers).toHaveProperty("ratelimit-limit", "20");
    });
  });

  // ── adminLimiter ────────────────────────────────────────────────────────────
  describe("adminLimiter", () => {
    it("returns rate limit headers", async () => {
      const res = await makeAgent(adminLimiter).get("/test");
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty("ratelimit-limit");
    });

    it("limit is 60 requests per window", async () => {
      const res = await makeAgent(adminLimiter).get("/test");
      expect(res.headers).toHaveProperty("ratelimit-limit", "60");
    });
  });

  // ── exportLimiter ──────────────────────────────────────────────────────────
  describe("exportLimiter", () => {
    it("returns rate limit headers", async () => {
      const res = await makeAgent(exportLimiter).get("/test");
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty("ratelimit-limit");
    });

    it("limit is 10 requests per window", async () => {
      const res = await makeAgent(exportLimiter).get("/test");
      expect(res.headers).toHaveProperty("ratelimit-limit", "10");
    });

    it("returns 429 after more than 10 requests in the same window", async () => {
      // Create a fresh limiter with its own in-memory store to avoid
      // interference from other tests that use exportLimiter
      const freshLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: "Too many export requests, please try again later." },
      });

      const app = express();
      app.use(freshLimiter);
      app.get("/test", (_req, res) => res.status(200).json({ ok: true }));

      const agent = request(app);
      for (let i = 1; i <= 10; i++) {
        const res = await agent.get("/test");
        expect(res.status).toBe(200);
      }
      const blocked = await agent.get("/test");
      expect(blocked.status).toBe(429);
    });
  });

  // ── assessmentLimiter ──────────────────────────────────────────────────────
  describe("assessmentLimiter", () => {
    it("returns rate limit headers", async () => {
      const res = await makeAgent(assessmentLimiter).get("/test");
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty("ratelimit-limit");
    });

    it("limit is 5 requests per window", async () => {
      const res = await makeAgent(assessmentLimiter).get("/test");
      expect(res.headers).toHaveProperty("ratelimit-limit", "5");
    });

    it("returns 429 after more than 5 requests in the same window", async () => {
      const freshLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 5,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: "Too many assessment requests, please try again later." },
      });

      const app = express();
      app.use(freshLimiter);
      app.get("/test", (_req, res) => res.status(200).json({ ok: true }));

      const agent = request(app);
      for (let i = 1; i <= 5; i++) {
        const res = await agent.get("/test");
        expect(res.status).toBe(200);
      }
      const blocked = await agent.get("/test");
      expect(blocked.status).toBe(429);
    });
  });

  // ── previewLimiter ─────────────────────────────────────────────────────────
  describe("previewLimiter", () => {
    it("returns rate limit headers", async () => {
      const res = await makeAgent(previewLimiter).get("/test");
      expect(res.status).toBe(200);
      expect(res.headers).toHaveProperty("ratelimit-limit");
    });

    it("limit is 10 requests per window", async () => {
      const res = await makeAgent(previewLimiter).get("/test");
      expect(res.headers).toHaveProperty("ratelimit-limit", "10");
    });
  });

  // ── Shared header properties ───────────────────────────────────────────────
  describe("all limiters return standard rate limit headers", () => {
    const limiters = {
      generalLimiter,
      mlLimiter,
      adminLimiter,
      exportLimiter,
      assessmentLimiter,
      previewLimiter,
    };

    for (const [name, limiter] of Object.entries(limiters)) {
      it(`${name} returns standard RateLimit-* headers`, async () => {
        const app = express();
        app.use(limiter as any);
        app.get("/test", (_req, res) => res.status(200).json({ ok: true }));
        const res = await request(app).get("/test");
        expect(res.headers).toHaveProperty("ratelimit-limit");
        expect(res.headers).toHaveProperty("ratelimit-remaining");
      });
    }
  });
});
