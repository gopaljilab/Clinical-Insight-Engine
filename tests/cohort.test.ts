import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createServer } from "http";

const { mockExecFile, rateLimitCounters, mockGetCohortStats } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  rateLimitCounters: new Map<string, number>(),
  mockGetCohortStats: vi.fn().mockResolvedValue({
    total: 10,
    riskDistribution: { HIGH: 3, MODERATE: 4, LOW: 3 },
    comorbidityRate: 0.3,
  }),
}));

vi.mock("child_process", () => ({
  execFile: mockExecFile,
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    info: vi.fn().mockResolvedValue(""),
  })),
}));

vi.mock("bullmq", () => {
  const mockQueue = {
    add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
    getJob: vi.fn().mockResolvedValue(null),
  };
  return {
    Queue: vi.fn().mockImplementation(() => mockQueue),
    Worker: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
  };
});

vi.mock("express-rate-limit", () => {
  const rateLimit = (options: any) => (req: any, res: any, next: any) => {
    const key = req.ip || "test";
    const count = (rateLimitCounters.get(key) || 0) + 1;
    rateLimitCounters.set(key, count);
    if (count > (options.limit || 500)) {
      return res.status(429).json({ error: options.message?.error || "Too many requests" });
    }
    next();
  };
  return { rateLimit, default: rateLimit };
});

vi.mock("../server/storage", () => {
  const mockStorageInstance = {
    getAssessments: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 }),
    createAssessment: vi.fn(),
    searchAssessments: vi.fn().mockResolvedValue([]),
    getAssessmentById: vi.fn().mockResolvedValue(undefined),
    getUserByEmail: vi.fn().mockResolvedValue({ id: "admin-id" }),
    createUser: vi.fn().mockResolvedValue({ id: "admin-id" }),
    getCohortStats: mockGetCohortStats,
  };
  return {
    storage: mockStorageInstance,
    DatabaseStorage: vi.fn().mockImplementation(() => mockStorageInstance),
  };
});

vi.mock("../server/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("fs", () => ({ existsSync: vi.fn().mockReturnValue(false) }));
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { registerRoutes } from "../server/routes";

function appWithUser(user: Record<string, any>) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => {
    req.session.user = user as any;
    next();
  });
  return app;
}

describe("GET /assessments/cohort — requireVerified enforcement (#1666)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitCounters.clear();
  });

  it("rejects an unverified authenticated user with 403", async () => {
    const app = appWithUser({
      id: "unverified-user-id",
      email: "unverified@example.com",
      name: "Unverified User",
      emailVerified: false,
    });
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .get("/api/assessments/cohort")
      .query({ riskCategory: "HIGH" });

    expect(res.status).toBe(403);
    expect(mockGetCohortStats).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request with 401", async () => {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .get("/api/assessments/cohort")
      .query({ riskCategory: "HIGH" });

    expect(res.status).toBe(401);
    expect(mockGetCohortStats).not.toHaveBeenCalled();
  });

  it("allows a verified authenticated user through to the cohort stats", async () => {
    const app = appWithUser({
      id: "verified-user-id",
      email: "verified@example.com",
      name: "Verified User",
      emailVerified: true,
    });
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .get("/api/assessments/cohort")
      .query({ riskCategory: "HIGH" });

    expect(res.status).toBe(200);
    expect(mockGetCohortStats).toHaveBeenCalled();
  });
});