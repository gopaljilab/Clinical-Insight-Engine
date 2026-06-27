import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";
import { MLService, pythonDaemon, calculateClinicalFallback } from "../server/services/mlService";
import { logger } from "../server/logger";

const { mockCreateAssessment, mockGetAssessments } = vi.hoisted(() => ({
  mockCreateAssessment: vi.fn(),
  mockGetAssessments: vi.fn(),
}));

vi.mock("../server/storage", () => {
  const mockStorageInstance = {
    getAssessments: mockGetAssessments,
    createAssessment: mockCreateAssessment,
    createAssessmentsBatch: vi.fn().mockImplementation(async (batch) => batch.map((item: any, idx: number) => ({ id: idx + 1, ...item, createdAt: new Date() }))),
    searchAssessments: vi.fn().mockResolvedValue([]),
    getAssessmentById: vi.fn().mockResolvedValue(undefined),
    deleteAssessment: vi.fn().mockResolvedValue(undefined),
    getUserByEmail: vi.fn().mockResolvedValue({ id: "admin-id" }),
    getUserById: vi.fn().mockResolvedValue({ id: "test-user-id", email: "test@example.com", isActive: true, role: "provider" }),
    createUser: vi.fn().mockResolvedValue({ id: "admin-id" }),
    recordPatientAccess: vi.fn().mockResolvedValue(undefined),
  };
  return {
    storage: mockStorageInstance,
    DatabaseStorage: vi.fn().mockImplementation(() => mockStorageInstance),
  };
});

vi.mock("../server/db", () => ({
  getDb: vi.fn().mockReturnValue({}),
  verifyDatabaseConnection: vi.fn().mockResolvedValue(undefined),
  closePool: vi.fn().mockResolvedValue(undefined),
  getPool: vi.fn(),
  DatabaseStartupError: class DatabaseStartupError extends Error {
    constructor(msg: string) { super(msg); this.name = "DatabaseStartupError"; }
  },
}));

vi.mock("express-rate-limit", () => {
  const rateLimit = (options: any) => {
    return (req: any, res: any, next: any) => next();
  };
  return { rateLimit, default: rateLimit };
});

vi.mock("child_process", () => ({
  execFile: vi.fn(),
  spawn: vi.fn(),
}));

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

const pythonSuccessOutput = {
  riskScore: 12.3,
  riskCategory: "LOW" as const,
  factors: [{ name: "Age", impact: "positive" as const, description: "Increases risk" }],
  clinicianAdvice: ["Monitor annually."],
  patientAdvice: ["Keep it up!"],
  confidenceInterval: "8.5% - 16.1%",
  modelConfidence: 0.877,
};

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

describe("Batch processing timeout and retry integration", () => {
  let warnSpy: any;
  let errorSpy: any;
  let originalEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => ({} as any));
    errorSpy = vi.spyOn(logger, "error").mockImplementation(() => ({} as any));

    originalEnv = { ...process.env };
    process.env.REQUEST_TIMEOUT = "50";
    process.env.MAX_RETRIES = "2"; // Use 2 retries in tests to make it faster
    process.env.RETRY_BACKOFF_FACTOR = "1.05"; // Extremely low backoff
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    process.env = originalEnv;
  });

  it("runAssessmentInference retries on API timeout and succeeds on retry", async () => {
    let calls = 0;
    const predictSpy = vi.spyOn(pythonDaemon, "predict").mockImplementation(async () => {
      calls++;
      if (calls < 2) {
        throw new Error("Clinical assessment timed out.");
      }
      return pythonSuccessOutput;
    });

    try {
      const result = await MLService.runAssessmentInference(validPayload, "test-doc-1");
      expect(result.prediction.riskScore).toBe(12.3);
      expect(calls).toBe(2);

      const warned = warnSpy.mock.calls.some((c: any) =>
        c[0]?.includes("WARN: API timeout on Document ID test-doc-1") ||
        (typeof c[0] === "string" && c[0].includes("WARN: API timeout on Document ID test-doc-1")) ||
        c[1]?.includes("WARN: API timeout on Document ID test-doc-1")
      );
      expect(warned).toBe(true);
    } finally {
      predictSpy.mockRestore();
    }
  }, 10000);

  it("runAssessmentInference retries on 429 rate limit errors", async () => {
    let calls = 0;
    const predictSpy = vi.spyOn(pythonDaemon, "predict").mockImplementation(async () => {
      calls++;
      if (calls < 2) {
        throw new Error("External service returned 429: Too Many Requests");
      }
      return pythonSuccessOutput;
    });

    try {
      const result = await MLService.runAssessmentInference(validPayload, "test-doc-2");
      expect(result.prediction.riskScore).toBe(12.3);
      expect(calls).toBe(2);
    } finally {
      predictSpy.mockRestore();
    }
  }, 10000);

  it("runAssessmentInference retries on connection failure/daemon crash and throws error after retries are exhausted", async () => {
    let calls = 0;
    const predictSpy = vi.spyOn(pythonDaemon, "predict").mockImplementation(async () => {
      calls++;
      throw new Error("ECONNREFUSED: Connection refused by Python daemon");
    });

    try {
      await expect(
        MLService.runAssessmentInference(validPayload, "test-doc-3", { throwOnFailure: true })
      ).rejects.toThrow("ECONNREFUSED");

      expect(calls).toBe(3); // 1 initial + 2 retries = 3 attempts

      const errored = errorSpy.mock.calls.some((c: any) =>
        c[0]?.includes("ERROR: Failed after 2 retries on Document ID test-doc-3") ||
        (typeof c[0] === "string" && c[0].includes("ERROR: Failed after 2 retries on Document ID test-doc-3")) ||
        c[1]?.includes("ERROR: Failed after 2 retries on Document ID test-doc-3")
      );
      expect(errored).toBe(true);
    } finally {
      predictSpy.mockRestore();
    }
  }, 20000);

  it("upload routes sequential batch loop continues processing when a document fails after retries", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    // Mock first row to succeed, second row to fail with timeout (exhaust retries), third to succeed
    const predictSpy = vi.spyOn(pythonDaemon, "predict").mockImplementation(async (input: any) => {
      console.log("Mock predict received input:", input);
      if (input.patientName === "Patient Success 1" || input.patientName === "Patient Success 2") {
        return pythonSuccessOutput;
      }
      throw new Error("Clinical assessment timed out.");
    });

    const csvContent = 
`patientName,gender,age,hypertension,heartDisease,smokingHistory,bmi,hba1cLevel,bloodGlucoseLevel
Patient Success 1,Male,45,false,false,never,24.5,5.2,95
Patient Fail,Female,50,true,false,former,30.0,7.0,150
Patient Success 2,Male,60,false,true,current,28.0,5.8,110`;

    mockCreateAssessment.mockResolvedValue({ id: 10 });

    try {
      const res = await request(app)
        .post("/api/upload/lab-results")
        .attach("file", Buffer.from(csvContent), "test_upload.csv");

      console.log("Upload route returned body:", res.body);

      expect(res.status).toBe(200);
      expect(res.body.processed).toBe(3);
      expect(res.body.created).toBe(2);
      expect(res.body.failed).toBe(1);

      // Verify that warnings and error logs were written for the failed patient
      const warned = warnSpy.mock.calls.some((c: any) =>
        c[0]?.includes("WARN: API timeout on Document ID Patient Fail") ||
        (typeof c[0] === "string" && c[0].includes("WARN: API timeout on Document ID Patient Fail")) ||
        c[1]?.includes("WARN: API timeout on Document ID Patient Fail")
      );
      expect(warned).toBe(true);

      const errored = errorSpy.mock.calls.some((c: any) =>
        c[0]?.includes("ERROR: Failed after 2 retries on Document ID Patient Fail") ||
        (typeof c[0] === "string" && c[0].includes("ERROR: Failed after 2 retries on Document ID Patient Fail")) ||
        c[1]?.includes("ERROR: Failed after 2 retries on Document ID Patient Fail")
      );
      expect(errored).toBe(true);
    } finally {
      predictSpy.mockRestore();
    }
  }, 20000);
});
