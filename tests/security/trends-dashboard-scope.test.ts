import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createServer } from "http";

const { mockExecFile, rateLimitCounters, fakeAssessments } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  rateLimitCounters: new Map<string, number>(),
  // In-memory stand-in for the assessments table, keyed loosely enough to
  // let getTrendsDashboardData apply the same patientName + createdBy
  // filtering the real repository applies.
  fakeAssessments: [] as Array<{
    id: number;
    patientName: string;
    createdBy: string;
    riskScore: number;
    riskCategory: string;
    createdAt: Date;
  }>,
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

vi.mock("../../server/storage", () => {
  // A minimal fake that mirrors the *fixed* repository's behavior: it only
  // returns rows matching patientName, and — the fix under test — only rows
  // matching createdBy when a createdBy is supplied.
  const mockStorageInstance = {
    getAssessments: vi.fn().mockResolvedValue({ data: [], total: 0, page: 1, totalPages: 0 }),
    createAssessment: vi.fn(),
    searchAssessments: vi.fn().mockResolvedValue([]),
    getAssessmentById: vi.fn().mockResolvedValue(undefined),
    getUserByEmail: vi.fn().mockResolvedValue({ id: "admin-id" }),
    createUser: vi.fn().mockResolvedValue({ id: "admin-id" }),
    getTrendsDashboardData: vi.fn(async (patientName: string, startDate?: string, endDate?: string, createdBy?: string) => {
      const rows = fakeAssessments.filter((a) => {
        if (a.patientName !== patientName) return false;
        if (createdBy && a.createdBy !== createdBy) return false;
        return true;
      });
      return {
        assessments: rows,
        summary: {
          total: rows.length,
          latestRiskScore: rows.length ? rows[rows.length - 1].riskScore : null,
          latestRiskCategory: rows.length ? rows[rows.length - 1].riskCategory : null,
          earliestRiskScore: rows.length ? rows[0].riskScore : null,
          trend: "stable",
          avgRiskScore: rows.length ? rows.reduce((s, r) => s + r.riskScore, 0) / rows.length : 0,
          change: 0,
        },
      };
    }),
  };
  return {
    storage: mockStorageInstance,
    DatabaseStorage: vi.fn().mockImplementation(() => mockStorageInstance),
  };
});

vi.mock("../../server/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("fs", () => ({ existsSync: vi.fn().mockReturnValue(false) }));
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { registerRoutes } from "../../server/routes";

function appAuthenticatedAs(userId: string, email: string) {
  const app = express();
  app.use(express.json());
  app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
  app.use((req, _res, next) => {
    req.session.user = {
      id: userId,
      email,
      name: userId,
      emailVerified: true,
    } as any;
    next();
  });
  return app;
}

describe("GET /api/assessments/trends/dashboard — cross-provider scoping (#1665)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rateLimitCounters.clear();
    fakeAssessments.length = 0;
    fakeAssessments.push({
      id: 1,
      patientName: "John Doe",
      createdBy: "provider-a@example.com",
      riskScore: 42,
      riskCategory: "MODERATE",
      createdAt: new Date("2026-01-01"),
    });
  });

  it("does not leak another provider's patient trend data for a same-named patient", async () => {
    const appA = appAuthenticatedAs("provider-a-id", "provider-a@example.com");
    await registerRoutes(createServer(), appA);

    const resA = await request(appA)
      .get("/api/assessments/trends/dashboard")
      .query({ patientName: "John Doe" });

    expect(resA.status).toBe(200);
    expect(resA.body.summary.total).toBe(1);

    const appB = appAuthenticatedAs("provider-b-id", "provider-b@example.com");
    await registerRoutes(createServer(), appB);

    const resB = await request(appB)
      .get("/api/assessments/trends/dashboard")
      .query({ patientName: "John Doe" });

    // Provider B created no assessments for "John Doe" — they must not see
    // Provider A's data just because the patient name string matches.
    expect(resB.status).toBe(200);
    expect(resB.body.summary.total).toBe(0);
    expect(resB.body.assessments).toEqual([]);
  });

  it("threads the authenticated user's email through to the storage layer as createdBy", async () => {
    const { storage } = await import("../../server/storage");
    const app = appAuthenticatedAs("provider-a-id", "provider-a@example.com");
    await registerRoutes(createServer(), app);

    await request(app)
      .get("/api/assessments/trends/dashboard")
      .query({ patientName: "John Doe" });

    expect(storage.getTrendsDashboardData).toHaveBeenCalledWith(
      "John Doe",
      undefined,
      undefined,
      "provider-a@example.com",
    );
  });

  it("rejects unauthenticated requests", async () => {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .get("/api/assessments/trends/dashboard")
      .query({ patientName: "John Doe" });

    expect(res.status).toBe(401);
  });
});