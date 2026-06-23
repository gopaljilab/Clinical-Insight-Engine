import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import mlRouter from "./ml.routes";

const { mockRunBatch, mockFallback, mockFingerprint, mockCreateBatch, mockActiveRequests } = vi.hoisted(() => ({
  mockRunBatch: vi.fn(),
  mockFallback: vi.fn(),
  mockFingerprint: vi.fn(() => "mock-fingerprint"),
  mockCreateBatch: vi.fn(),
  mockActiveRequests: new Set<string>(),
}));

vi.mock("express-rate-limit", () => {
  const rateLimit = () => (_req: any, _res: any, next: any) => next();
  return { rateLimit, default: rateLimit };
});

vi.mock("../services/mlService", () => ({
  MLService: {
    runAssessmentInferenceBatch: mockRunBatch,
    generateRequestFingerprint: mockFingerprint,
    get activeInferenceRequests() {
      return mockActiveRequests;
    },
  },
  calculateClinicalFallback: mockFallback,
}));

vi.mock("../storage", () => ({
  storage: {
    createAssessmentsBatch: mockCreateBatch,
  },
}));

vi.mock("../middleware/validateDTO", () => ({
  validateDTO: () => (_req: any, _res: any, next: any) => next(),
}));

const validAssessment = {
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

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.session = { user: { id: "test-user-id", email: "test@example.com", role: "provider", emailVerified: true } };
    next();
  });
  app.use("/ml", mlRouter);
  return app;
}

describe("POST /ml/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveRequests.clear();
  });

  it("returns 201 with created assessments on successful batch processing", async () => {
    mockRunBatch.mockResolvedValue({
      predictions: [
        { riskScore: 15.0, riskCategory: "LOW", factors: [], confidenceInterval: "10-20", modelConfidence: 0.9 },
        { riskScore: 65.0, riskCategory: "HIGH", factors: [], confidenceInterval: "55-75", modelConfidence: 0.8 },
      ],
    });
    mockFingerprint.mockReturnValue("unique-fingerprint-123");
    mockCreateBatch.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const response = await request(createApp())
      .post("/ml/bulk")
      .send({ assessments: [validAssessment, { ...validAssessment, age: 55 }] })
      .expect(201);

    expect(response.body.count).toBe(2);
    expect(response.body.batchId).toBeDefined();
    expect(mockRunBatch).toHaveBeenCalled();
    expect(mockCreateBatch).toHaveBeenCalled();
  });

  it("returns 400 when assessments array is empty", async () => {
    const response = await request(createApp())
      .post("/ml/bulk")
      .send({ assessments: [] })
      .expect(400);

    expect(response.body.message).toMatch(/empty/i);
  });

  it("returns 409 when the same fingerprint is already processing", async () => {
    mockFingerprint.mockReturnValue("duplicate-fingerprint");
    mockActiveRequests.add("duplicate-fingerprint");

    const response = await request(createApp())
      .post("/ml/bulk")
      .send({ assessments: [validAssessment] })
      .expect(409);

    expect(response.body.message).toMatch(/already processing/i);
  });

  it("returns 201 with fallback predictions when ML service throws", async () => {
    mockFingerprint.mockReturnValue("fallback-fingerprint");
    mockRunBatch.mockRejectedValue(new Error("Python daemon unavailable"));
    mockFallback.mockReturnValue([
      { riskScore: 20.0, riskCategory: "LOW", factors: [], confidenceInterval: null, modelConfidence: null },
    ]);
    mockCreateBatch.mockResolvedValue([{ id: 3 }]);

    const response = await request(createApp())
      .post("/ml/bulk")
      .send({ assessments: [validAssessment] })
      .expect(201);

    expect(response.body.count).toBe(1);
    expect(mockFallback).toHaveBeenCalled();
  });

  it("returns 401 when user is not authenticated", async () => {
    const unauthApp = express();
    unauthApp.use(express.json());
    unauthApp.use("/ml", mlRouter);

    const response = await request(unauthApp)
      .post("/ml/bulk")
      .send({ assessments: [validAssessment] })
      .expect(401);

    expect(response.body.message).toMatch(/auth/i);
  });
});
