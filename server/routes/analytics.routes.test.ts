import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import analyticsRouter from "./analytics.routes";

vi.mock("express-rate-limit", () => {
  const rateLimit = () => (_req: any, _res: any, next: any) => next();
  return { rateLimit, default: rateLimit };
});

const { mockGetAnalyticsStats } = vi.hoisted(() => ({
  mockGetAnalyticsStats: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getAnalyticsStats: mockGetAnalyticsStats,
  },
}));

function createAuthenticatedApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret-analytics",
      resave: false,
      saveUninitialized: false,
    })
  );
  // Bypass requireAuth by injecting session user directly
  app.use((req, _res, next) => {
    (req as any).session.user = {
      id: "test-user-id",
      email: "test@example.com",
      role: "provider",
      emailVerified: true,
    };
    next();
  });
  app.use("/api", analyticsRouter);
  return app;
}

function createUnauthenticatedApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret-analytics",
      resave: false,
      saveUninitialized: false,
    })
  );
  // No user injected — session is empty
  app.use("/api", analyticsRouter);
  return app;
}

describe("GET /api/analytics", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createAuthenticatedApp();
  });

  it("returns 200 with analytics stats for an authenticated user", async () => {
    const stats = {
      totalAssessments: 42,
      avgRiskScore: 28.5,
      riskDistribution: [
        { category: "LOW", count: 20 },
        { category: "MODERATE", count: 15 },
        { category: "HIGH", count: 7 },
      ],
    };
    mockGetAnalyticsStats.mockResolvedValue(stats);

    const response = await request(app)
      .get("/api/analytics")
      .expect(200);

    expect(response.body).toEqual(stats);
    expect(mockGetAnalyticsStats).toHaveBeenCalledWith("test@example.com");
  });

  it("returns 401 when user is not authenticated", async () => {
    const unauthApp = createUnauthenticatedApp();
    const response = await request(unauthApp)
      .get("/api/analytics")
      .expect(401);

    expect(response.body.message).toMatch(/auth/i);
  });

  it("returns 500 when storage.getAnalyticsStats throws", async () => {
    mockGetAnalyticsStats.mockRejectedValue(new Error("Database connection failed"));

    const response = await request(app)
      .get("/api/analytics")
      .expect(500);

    expect(response.body.message).toBe("Failed to fetch analytics");
  });

  it("returns empty stats when no assessments exist", async () => {
    mockGetAnalyticsStats.mockResolvedValue({
      totalAssessments: 0,
      avgRiskScore: null,
      riskDistribution: [],
    });

    const response = await request(app)
      .get("/api/analytics")
      .expect(200);

    expect(response.body.totalAssessments).toBe(0);
    expect(response.body.riskDistribution).toEqual([]);
  });
});
