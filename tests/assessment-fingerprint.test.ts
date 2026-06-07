import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createServer } from "http";

const { mockExecFile, rateLimitCounters, mockCreateAssessment, mockGetAssessments } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  rateLimitCounters: new Map<string, number>(),
  mockCreateAssessment: vi.fn(),
  mockGetAssessments: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: mockExecFile,
}));

vi.mock("ioredis", () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        on: vi.fn(),
        info: vi.fn().mockResolvedValue(""),
      };
    }),
  };
});

vi.mock("bullmq", () => {
  const mockQueue = {
    add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
    getJob: vi.fn().mockResolvedValue(null),
  };
  return {
    Queue: vi.fn().mockImplementation(() => mockQueue),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
    })),
  };
});

vi.mock("express-rate-limit", () => {
  const rateLimit = (options: any) => {
    return (req: any, res: any, next: any) => {
      const key = req.ip || "test";
      const count = (rateLimitCounters.get(key) || 0) + 1;
      rateLimitCounters.set(key, count);
      if (count > (options.limit || 5)) {
        return res.status(429).json({
          error: options.message?.error || "Too many requests",
        });
      }
      next();
    };
  };
  return { rateLimit, default: rateLimit };
});

vi.mock("../server/storage", () => {
  const mockStorageInstance = {
    getAssessments: mockGetAssessments,
    createAssessment: mockCreateAssessment,
    searchAssessments: vi.fn().mockResolvedValue([]),
    getAssessmentById: vi.fn().mockResolvedValue(undefined),
    getUserByEmail: vi.fn().mockResolvedValue({ id: "admin-id" }),
    createUser: vi.fn().mockResolvedValue({ id: "admin-id" }),
  };
  return {
    storage: mockStorageInstance,
    DatabaseStorage: vi.fn().mockImplementation(() => mockStorageInstance),
  };
});

vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { registerRoutes } from "../server/routes";
import { MLService } from "../server/services/mlService";

const validPayload = {
  patientName: "John Doe",
  gender: "Male",
  age: 45,
  hypertension: false,
  heartDisease: false,
  smokingHistory: "never",
  bmi: 24.5,
  hba1cLevel: 5.2,
  bloodGlucoseLevel: 95,
};

const pythonSuccessOutput = JSON.stringify({
  riskScore: 12.3,
  riskCategory: "LOW",
  factors: [{ name: "Age", impact: "positive", description: "Increases risk" }],
  clinicianAdvice: ["Monitor annually."],
  patientAdvice: ["Keep it up!"],
  confidenceInterval: "8.5% - 16.1%",
  modelConfidence: 0.877,
});

function createAuthenticatedApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use((req, res, next) => {
    req.session.user = {
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
    };
    next();
  });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitCounters.clear();
  // Clear any leftover fingerprints between tests
  MLService.activeInferenceRequests.clear();

  mockCreateAssessment.mockImplementation((input) =>
    Promise.resolve({ id: 1, ...input, createdAt: new Date() })
  );
  mockGetAssessments.mockResolvedValue({
    data: [],
    total: 0,
    page: 1,
    totalPages: 0,
  });
  mockExecFile.mockImplementation((cmd: any, args: any, opts: any, cb: any) => {
    if (typeof opts === "function") {
      cb = opts;
      cb(null, pythonSuccessOutput, "");
      return;
    }
    cb(null, pythonSuccessOutput, "");
  });
});

afterEach(() => {
  MLService.activeInferenceRequests.clear();
});

describe("Assessment request fingerprint lifecycle", () => {
  it("fingerprint is removed from activeInferenceRequests after a successful request", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    expect(MLService.activeInferenceRequests.size).toBe(0);

    const res = await request(app)
      .post("/api/assessments")
      .send(validPayload);

    expect(res.status).toBe(202);
    // After request completes, the fingerprint must be cleaned up
    expect(MLService.activeInferenceRequests.size).toBe(0);
  });

  it("fingerprint is removed from activeInferenceRequests after a queue failure", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    // Make the queue.add() call reject by importing the mocked queue
    const { getAssessmentQueue } = await import("../server/queue");
    (getAssessmentQueue().add as any).mockRejectedValueOnce(new Error("Redis connection failed"));

    const res = await request(app)
      .post("/api/assessments")
      .send(validPayload);

    expect(res.status).toBe(500);
    // Fingerprint must still be cleaned up even after error
    expect(MLService.activeInferenceRequests.size).toBe(0);
  });

  it("duplicate concurrent requests return 409 Conflict", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    // Pre-populate the fingerprint to simulate an in-flight request
    const fingerprint = MLService.generateRequestFingerprint(validPayload, "test-user-id");
    MLService.activeInferenceRequests.add(fingerprint);

    const res = await request(app)
      .post("/api/assessments")
      .send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already being processed/i);
  });

  it("identical request succeeds after a previous identical request has completed", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    // First request
    const res1 = await request(app)
      .post("/api/assessments")
      .send(validPayload);

    expect(res1.status).toBe(202);
    expect(MLService.activeInferenceRequests.size).toBe(0);

    // Second identical request should succeed, not 409
    const res2 = await request(app)
      .post("/api/assessments")
      .send(validPayload);

    expect(res2.status).toBe(202);
    expect(MLService.activeInferenceRequests.size).toBe(0);
  });
});
