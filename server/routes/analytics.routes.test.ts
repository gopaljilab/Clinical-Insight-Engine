import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const mockGetAnalyticsStats = vi.fn();
  const mockRequireAuth = vi.fn();
  const mockRequireVerified = vi.fn();
  return {
    mockGetAnalyticsStats,
    mockRequireAuth,
    mockRequireVerified,
    mockStorage: { getAnalyticsStats: mockGetAnalyticsStats },
  };
});

vi.mock("../storage", () => ({ storage: mocks.mockStorage }));
vi.mock("../auth", () => ({
  requireAuth: mocks.mockRequireAuth,
  requireVerified: mocks.mockRequireVerified,
}));

import analyticsRouter from "./analytics.routes";
import request from "supertest";
import express from "express";

function buildApp(withSession = false) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (withSession) {
      req.session = { user: { email: "test@example.com", id: "1" } };
    }
    next();
  });
  app.use("/api", analyticsRouter);
  return app;
}

describe("GET /api/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireAuth.mockImplementation((req, res, next) => {
      if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      next();
    });
    mocks.mockRequireVerified.mockImplementation((_req, _res, next) => next());
  });

  it("returns 401 when unauthenticated", async () => {
    const app = buildApp(false);
    const res = await request(app).get("/api/analytics");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("returns 200 with stats JSON when authenticated", async () => {
    const stats = { total: 10, highRisk: 3, mediumRisk: 4, lowRisk: 3 };
    mocks.mockGetAnalyticsStats.mockResolvedValue(stats);
    const app = buildApp(true);
    const res = await request(app).get("/api/analytics");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stats);
  });

  it("calls storage.getAnalyticsStats with user email from session", async () => {
    mocks.mockGetAnalyticsStats.mockResolvedValue({});
    const app = buildApp(true);
    await request(app).get("/api/analytics");
    expect(mocks.mockGetAnalyticsStats).toHaveBeenCalledWith("test@example.com");
  });

  it("returns 500 when storage throws an error", async () => {
    mocks.mockGetAnalyticsStats.mockRejectedValue(new Error("DB connection failed"));
    const app = buildApp(true);
    const res = await request(app).get("/api/analytics");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Failed to fetch analytics");
  });
});
