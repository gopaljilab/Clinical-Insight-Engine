import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";
import { MLService } from "../server/services/mlService";

// Mock redis / bullmq so background queues do not initialize/hang the test process
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
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: vi.fn(),
      getJob: vi.fn(),
    })),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
    })),
  };
});

vi.mock("../server/db", () => ({
  getDb: vi.fn().mockReturnValue({
    transaction: vi.fn(),
  }),
  verifyDatabaseConnection: vi.fn().mockResolvedValue(undefined),
  closePool: vi.fn().mockResolvedValue(undefined),
  getPool: vi.fn(),
  DatabaseStartupError: class DatabaseStartupError extends Error {
    constructor(msg: string) { super(msg); this.name = "DatabaseStartupError"; }
  },
}));

vi.mock("../server/storage", () => {
  const mockStorageInstance = {
    getUserByEmail: vi.fn().mockResolvedValue({ id: "admin-id" }),
    getUserById: vi.fn().mockResolvedValue({ id: "test-user-id", email: "test@example.com", isActive: true, role: "provider" }),
    getAssessments: vi.fn().mockResolvedValue({ data: [] }),
  };
  return {
    storage: mockStorageInstance,
    DatabaseStorage: vi.fn().mockImplementation(() => mockStorageInstance),
  };
});

describe("Clinical Analysis Route Integration Tests", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function createAuthenticatedApp() {
    const appInstance = express();
    appInstance.use(express.json());
    appInstance.use(
      session({
        secret: "test-secret-clinical-routes",
        resave: false,
        saveUninitialized: false,
      })
    );
    appInstance.use((req, res, next) => {
      req.session.user = {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
        emailVerified: true,
        role: "provider",
        isActive: true,
      };
      next();
    });

    const server = createServer(appInstance);
    await registerRoutes(server, appInstance);
    return appInstance;
  }

  async function createUnauthenticatedApp() {
    const appInstance = express();
    appInstance.use(express.json());
    appInstance.use(
      session({
        secret: "test-secret-clinical-routes-unauth",
        resave: false,
        saveUninitialized: false,
      })
    );
    // DO NOT set req.session.user

    const server = createServer(appInstance);
    await registerRoutes(server, appInstance);
    return appInstance;
  }

  it("POST /api/v1/clinical/analyze successfully extracts symptoms and medications when authenticated", async () => {
    app = await createAuthenticatedApp();
    
    // Spy on MLService.runClinicalAnalysis
    const runClinicalAnalysisSpy = vi.spyOn(MLService, "runClinicalAnalysis").mockResolvedValue({
      result: {
        symptoms: ["cough", "fever"],
        medications: ["metformin"],
        model_name: "test-mock-biobert",
      },
      isFallback: false,
    });

    const payload = {
      text: "Patient presents with cough and fever. Prescribed metformin.",
    };

    const res = await request(app)
      .post("/api/v1/clinical/analyze")
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      symptoms: ["cough", "fever"],
      medications: ["metformin"],
      model_name: "test-mock-biobert",
    });
    expect(runClinicalAnalysisSpy).toHaveBeenCalledWith("Patient presents with cough and fever. Prescribed metformin.");
  });

  it("POST /api/v1/clinical/analyze returns 401 Unauthorized when unauthenticated", async () => {
    app = await createUnauthenticatedApp();

    const payload = {
      text: "Patient notes",
    };

    const res = await request(app)
      .post("/api/v1/clinical/analyze")
      .send(payload);

    expect(res.status).toBe(401);
  });

  it("POST /api/v1/clinical/analyze returns 400 Bad Request when text is empty", async () => {
    app = await createAuthenticatedApp();

    const payload = {
      text: "",
    };

    const res = await request(app)
      .post("/api/v1/clinical/analyze")
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toContain("empty");
  });

  it("POST /api/v1/clinical/analyze returns 400 Bad Request when text is missing", async () => {
    app = await createAuthenticatedApp();

    const payload = {};

    const res = await request(app)
      .post("/api/v1/clinical/analyze")
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });
});
