import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createServer } from "http";
import patientsRouter from "../server/routes/patients";
import { issueToken } from "../server/services/auth/tokenValidator";

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
    getJob: vi.fn().mockResolvedValue({
      id: "mock-job-id",
      getState: vi.fn().mockResolvedValue("completed"),
      returnvalue: {
        id: 1,
        patientName: "John Doe",
        gender: "Male",
        age: 45,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: 24.5,
        hba1cLevel: 5.2,
        bloodGlucoseLevel: 95,
        riskScore: 12.3,
        riskCategory: "LOW",
        factors: [{ name: "Age", impact: "positive", description: "Increases risk" }],
        createdBy: "test-user-id",
        createdAt: new Date(),
      },
    }),
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
import { pythonDaemon } from "../server/services/mlService";

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

function createUnauthenticatedApp() {
  const app = express();
  app.use(express.json());
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitCounters.clear();
  mockCreateAssessment.mockImplementation((input) =>
    Promise.resolve({ id: 1, ...input, createdAt: new Date() })
  );
  mockGetAssessments.mockResolvedValue({
    data: [],
    nextCursor: null,
  });
  mockExecFile.mockImplementation((cmd, args, opts, cb) => {
    if (typeof opts === "function") {
      cb = opts;
      cb(null, pythonSuccessOutput, "");
      return;
    }
    cb(null, pythonSuccessOutput, "");
  });
});

describe("Auth gating", () => {
  it("returns 401 for POST /api/assessments without session", async () => {
    const app = createUnauthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .post("/api/assessments")
      .send(validPayload);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 401 for POST /api/assessments/preview without session", async () => {
    const app = createUnauthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .post("/api/assessments/preview")
      .send(validPayload);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 401 for POST /api/assessments/simulate without session", async () => {
    const app = createUnauthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .post("/api/assessments/simulate")
      .send(validPayload);

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 401 for GET /api/assessments without session", async () => {
    const app = createUnauthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app).get("/api/assessments");

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });
});

describe("Health Check Endpoint", () => {
  it("returns 200 OK and valid JSON with status, timestamp, and uptime", async () => {
    const app = createUnauthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body).toHaveProperty("uptime");
    expect(typeof res.body.uptime).toBe("number");
  });
});

describe("Schema validation", () => {
  it("returns 400 when required field 'age' is missing", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app).post("/api/assessments").send({
      gender: "Male",
      hypertension: false,
      heartDisease: false,
      smokingHistory: "never",
      bmi: 24.5,
      hba1cLevel: 5.2,
      bloodGlucoseLevel: 95,
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 400 for empty body", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .post("/api/assessments")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 400 for out-of-range age", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .post("/api/assessments")
      .send({ ...validPayload, age: 999 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });

  it("returns 400 for invalid smokingHistory", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .post("/api/assessments")
      .send({ ...validPayload, smokingHistory: "invalid-value" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });
});

describe("Rate limiting", () => {
  it("returns 429 after exceeding the rate limit for POST /api/assessments", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    let lastStatus = 200;
    for (let i = 0; i < 101; i++) {
      const res = await request(app)
        .post("/api/assessments")
        .send({ ...validPayload, age: 20 + (i % 50) });
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });
});

describe("Python inference", () => {
  it("returns 200 with simulated risk, risk category, and factor contributions", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const predictSpy = vi.spyOn(pythonDaemon, "predict").mockResolvedValue(JSON.parse(pythonSuccessOutput));

    try {
      const res = await request(app)
        .post("/api/assessments/simulate")
        .send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("simulatedRisk", 12.3);
      expect(res.body).toHaveProperty("riskCategory", "LOW");
      expect(res.body).toHaveProperty("confidence", 0.877);
      expect(res.body).toHaveProperty("factorContributions");
      expect(Array.isArray(res.body.factorContributions)).toBe(true);
    } finally {
      predictSpy.mockRestore();
    }
  });

  it("returns 202 with jobId on success", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    mockCreateAssessment.mockResolvedValue({
      id: 1,
      ...validPayload,
      riskScore: 12.3,
      riskCategory: "LOW",
      factors: [{ name: "Age", impact: "positive", description: "Increases risk" }],
      createdBy: "test-user-id",
      createdAt: new Date(),
    });

    const res = await request(app)
      .post("/api/assessments")
      .send(validPayload);

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("jobId");
  });

  it("returns 202 with jobId when fallback prediction path is used in background queue", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      if (typeof opts === "function") {
        cb = opts;
        cb(new Error("Python not found"), null, "error");
        return;
      }
      cb(new Error("Python not found"), null, "error");
    });

    mockCreateAssessment.mockImplementation((input) =>
      Promise.resolve({
        id: 2,
        ...input,
        riskScore: input.riskScore,
        riskCategory: input.riskCategory,
        factors: input.factors,
        createdBy: "test-user-id",
        createdAt: new Date(),
      })
    );

    const res = await request(app)
      .post("/api/assessments")
      .send({ ...validPayload, age: 46 });

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("jobId");
  });

  it("preview returns risk metrics on successful inference", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const predictSpy = vi.spyOn(pythonDaemon, "predict").mockResolvedValue(JSON.parse(pythonSuccessOutput));

    try {
      const res = await request(app)
        .post("/api/assessments/preview")
        .send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("riskScore");
      expect(res.body).toHaveProperty("riskCategory");
      expect(res.body).toHaveProperty("factors");
    } finally {
      predictSpy.mockRestore();
    }
  });

  it("preview uses fallback when Python process fails", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const predictSpy = vi.spyOn(pythonDaemon, "predict").mockRejectedValue(new Error("Process killed"));

    try {
      const res = await request(app)
        .post("/api/assessments/preview")
        .send(validPayload);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("riskScore");
      expect(res.body).toHaveProperty("riskCategory");
      expect(res.body).toHaveProperty("factors");
    } finally {
      predictSpy.mockRestore();
    }
  });

  it("preview returns 503 when Python process times out", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const predictSpy = vi.spyOn(pythonDaemon, "predict").mockRejectedValue(new Error("timed out"));

    try {
      const res = await request(app)
        .post("/api/assessments/preview")
        .send(validPayload);

      expect(res.status).toBe(503);
      expect(res.body.message).toContain("timed out");
    } finally {
      predictSpy.mockRestore();
    }
  });

  it("bulk route returns 201 and falls back to rule-based model on python process failure", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      if (typeof opts === "function") {
        cb = opts;
        cb(new Error("Python execution failed"), null, "error");
        return;
      }
      cb(new Error("Python execution failed"), null, "error");
    });

    const res = await request(app)
      .post("/api/assessments/bulk")
      .send({
        assessments: [
          validPayload,
          { ...validPayload, patientName: "Jane Doe" }
        ]
      });

    console.log("DEBUG RESPONSE:", res.status, res.text, res.body);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("count", 2);
    expect(res.body).toHaveProperty("assessments");
    expect(Array.isArray(res.body.assessments)).toBe(true);
    expect(res.body.assessments[0]).toHaveProperty("riskScore");
    expect(res.body.assessments[1]).toHaveProperty("riskScore");
  });

  it("bulk route returns 201 and falls back to rule-based model on python process timeout", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    mockExecFile.mockImplementation((cmd, args, opts, cb) => {
      const err = new Error("Process timed out");
      (err as any).killed = true;
      if (typeof opts === "function") {
        cb = opts;
        cb(err, null, "");
        return;
      }
      cb(err, null, "");
    });

    const res = await request(app)
      .post("/api/assessments/bulk")
      .send({
        assessments: [
          validPayload,
          { ...validPayload, patientName: "Jane Doe" }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("count", 2);
    expect(res.body).toHaveProperty("assessments");
    expect(Array.isArray(res.body.assessments)).toBe(true);
    expect(res.body.assessments[0]).toHaveProperty("riskScore");
    expect(res.body.assessments[1]).toHaveProperty("riskScore");
  });
});

describe("Response shape", () => {
  it("GET /api/assessments returns paginated shape", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    mockGetAssessments.mockResolvedValue({
      data: [
        {
          id: 1,
          patientName: "John Doe",
          gender: "Male",
          age: 45,
          hypertension: false,
          heartDisease: false,
          smokingHistory: "never",
          bmi: 24.5,
          hba1cLevel: 5.2,
          bloodGlucoseLevel: 95,
          riskScore: 12.3,
          riskCategory: "LOW",
          factors: [],
          confidenceInterval: "8.5% - 16.1%",
          modelConfidence: 0.877,
          createdBy: "test@example.com",
          createdAt: new Date(),
          userId: null,
        },
      ],
      nextCursor: null,
    });

    const res = await request(app).get("/api/assessments");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("nextCursor");
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe("CSV export", () => {
  it("passes validated filters and the authenticated user scope to storage", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);
    mockGetAssessments.mockClear();

    mockGetAssessments.mockResolvedValue({
      data: [
        {
          patientName: "Jane Doe",
          gender: "Female",
          riskCategory: "HIGH",
          smokingHistory: "former",
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
      nextCursor: null,
    });

    const res = await request(app).get(
      "/api/assessments/export.csv?searchTerm=Jane&riskCategory=HIGH&gender=Female&startDate=2026-01-01&endDate=2026-01-31&page=2&limit=100&sortBy=patientName&order=asc"
    );

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("patientName,gender,riskCategory,smokingHistory");
    expect(res.text).toContain("Jane Doe,Female,HIGH,former");
    expect(mockGetAssessments).toHaveBeenCalledWith({
      searchTerm: "Jane",
      riskCategory: "HIGH",
      gender: "Female",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      page: 2,
      limit: 100,
      sortBy: "patientName",
      order: "asc",
      createdBy: "test@example.com",
    });
  });

  it("returns an empty CSV for valid filters with no matching results", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);
    mockGetAssessments.mockClear();

    mockGetAssessments.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 1000,
      totalPages: 0,
      nextCursor: null,
    });

    const res = await request(app).get("/api/assessments/export.csv?riskCategory=LOW");

    expect(res.status).toBe(200);
    expect(res.text).toBe("");
    expect(mockGetAssessments).toHaveBeenCalledWith(
      expect.objectContaining({
        riskCategory: "LOW",
        createdBy: "test@example.com",
      })
    );
  });

  it("rejects invalid export filters before querying storage", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);
    mockGetAssessments.mockClear();

    const res = await request(app).get("/api/assessments/export.csv?riskCategory=CRITICAL");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid risk category");
    expect(mockGetAssessments).not.toHaveBeenCalled();
  });
});

describe("GET /api/patients (JWT protected)", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const app = createAuthenticatedApp();
    app.use("/api/patients", patientsRouter);
    await registerRoutes(createServer(), app);

    const res = await request(app).get("/api/patients");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message", "Unauthorized");
  });

  it("returns 401 when Authorization header is malformed", async () => {
    const app = createAuthenticatedApp();
    app.use("/api/patients", patientsRouter);
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .get("/api/patients")
      .set("Authorization", "Bearer invalidtoken");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message", "Unauthorized");
  });

  it("returns 200 with patient data when valid JWT is provided", async () => {
    const app = createAuthenticatedApp();
    app.use("/api/patients", patientsRouter);
    await registerRoutes(createServer(), app);

    const userEmail = "test@example.com";
    const token = issueToken("test-user-id", userEmail, "provider");

    mockGetAssessments.mockResolvedValue({
      data: [
        {
          id: 1,
          patientName: "John Doe",
          gender: "Male",
          age: 45,
          hypertension: false,
          heartDisease: false,
          smokingHistory: "never",
          bmi: 24.5,
          hba1cLevel: 5.2,
          bloodGlucoseLevel: 95,
          riskScore: 12.3,
          riskCategory: "LOW",
          factors: [],
          confidenceInterval: "8.5% - 16.1%",
          modelConfidence: 0.877,
          createdBy: userEmail,
          createdAt: new Date(),
          userId: "test-user-id",
        },
      ],
      nextCursor: null,
    });

    const res = await request(app)
      .get("/api/patients")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]).toHaveProperty("patientName", "John Doe");
    // Ensure sensitive creator/user IDs are stripped/sanitized
    expect(res.body.data[0]).not.toHaveProperty("createdBy");
    expect(res.body.data[0]).not.toHaveProperty("userId");
  });
});

describe("Route uniqueness (no duplicate registrations)", () => {
  interface RouteEntry {
    method: string;
    path: string;
  }

  function collectRoutes(app: express.Express): RouteEntry[] {
    const routes: RouteEntry[] = [];

    function walk(stack: any[], prefix: string) {
      for (const layer of stack) {
        if (!layer) continue;
        if (layer.route) {
          const routePath = (layer.route.path as string) ?? "/";
          for (const method of Object.keys(layer.route.methods)) {
            routes.push({ method: method.toUpperCase(), path: prefix + routePath });
          }
        } else if (layer.handle?.stack) {
          const mountPath = typeof layer.path === "string" ? (layer.path as string) : "";
          walk(layer.handle.stack, prefix + mountPath);
        }
      }
    }

    walk((app as any)._router?.stack || [], "");
    return routes;
  }

  it("no duplicate route registrations across the entire app", async () => {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: "test", resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => {
      req.session.user = { id: "test", email: "test@test.com", name: "Test" };
      next();
    });
    await registerRoutes(createServer(), app);

    const routes = collectRoutes(app);
    const keyCounts = new Map<string, number>();
    for (const r of routes) {
      const key = `${r.method} ${r.path}`;
      keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
    }
    const duplicates = [...keyCounts.entries()]
      .filter(([, c]) => c > 1)
      .map(([k, c]) => `${k} (${c}x)`);
    expect(duplicates, `Duplicate routes found: ${duplicates.join(", ")}`).toEqual([]);
  });

  it("each assessment route is registered exactly once", async () => {
    const app = express();
    app.use(express.json());
    app.use(session({ secret: "test", resave: false, saveUninitialized: false }));
    app.use((req, _res, next) => {
      req.session.user = { id: "test", email: "test@test.com", name: "Test" };
      next();
    });
    await registerRoutes(createServer(), app);

    const routes = collectRoutes(app);
    const assessmentRoutes = routes.filter(r => r.path.startsWith("/api/assessments"));
    const keyCounts = new Map<string, number>();
    for (const r of assessmentRoutes) {
      const key = `${r.method} ${r.path}`;
      keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
    }
    const duplicates = [...keyCounts.entries()]
      .filter(([, c]) => c > 1)
      .map(([k, c]) => `${k} (${c}x)`);
    expect(duplicates, `Duplicate assessment routes: ${duplicates.join(", ")}`).toEqual([]);
  });
});
