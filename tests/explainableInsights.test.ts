import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";
import { extractExplainableInsights, parseFhirBundle, convertToInternalSchema } from "../server/services/fhirParser";

// 1. Mock MLService to isolate test from python daemon
const { mockCreateAssessment, mockRunAssessmentInference } = vi.hoisted(() => ({
  mockCreateAssessment: vi.fn(),
  mockRunAssessmentInference: vi.fn(),
}));

vi.mock("../server/services/mlService", () => {
  return {
    MLService: {
      runAssessmentInference: mockRunAssessmentInference,
      generateRequestFingerprint: vi.fn().mockReturnValue("mock-fingerprint"),
      activeInferenceRequests: new Set(),
    },
  };
});

// 2. Mock database storage
vi.mock("../server/storage", () => {
  const mockStorageInstance = {
    createAssessment: mockCreateAssessment,
    getUserByEmail: vi.fn().mockResolvedValue({ id: "admin-id" }),
    getUserById: vi.fn().mockResolvedValue({ id: "test-user-id", email: "test@example.com", isActive: true, role: "provider" }),
  };
  return {
    storage: mockStorageInstance,
    DatabaseStorage: vi.fn().mockImplementation(() => mockStorageInstance),
  };
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
  mockCreateAssessment.mockImplementation((input) =>
    Promise.resolve({ id: 1, ...input, createdAt: new Date() })
  );
  mockRunAssessmentInference.mockResolvedValue({
    prediction: {
      riskScore: 35.5,
      riskCategory: "MODERATE",
      factors: [{ name: "Age", impact: "positive", description: "Increases risk" }],
      clinicianAdvice: ["Monitor blood pressure."],
      patientAdvice: ["Keep regular checkups."],
    },
    isFallback: false,
  });
});

describe("Explainable Insights Unit Tests", () => {
  it("extracts hypertension from a BP reading regex pattern and returns exact indices", () => {
    const text = "Patient is 45 yo. BP reading 145/90 noted during morning round. Clear lungs.";
    const insights = extractExplainableInsights(text);

    const ht = insights.find(i => i.insight === "Patient shows signs of hypertension");
    expect(ht).toBeDefined();
    expect(ht?.source_snippet).toBe("BP reading 145/90 noted during morning round");
    expect(ht?.source_index).toEqual([18, 62]);
    // Double check text slice
    expect(text.substring(ht!.source_index![0], ht!.source_index![1])).toBe(ht?.source_snippet);
  });

  it("extracts hypertension from keyword matches when no vitals match", () => {
    const text = "Routine visit. Patient has mild hypertension and takes medication.";
    const insights = extractExplainableInsights(text);

    const ht = insights.find(i => i.insight === "Patient shows signs of hypertension");
    expect(ht).toBeDefined();
    expect(ht?.source_snippet).toBe("Patient has mild hypertension and takes medication");
    expect(ht?.source_index).toEqual([15, 65]);
  });

  it("extracts heart disease from keywords", () => {
    const text = "Patient has a history of coronary artery disease. Normal sinus rhythm.";
    const insights = extractExplainableInsights(text);

    const hd = insights.find(i => i.insight === "Patient shows signs of heart disease");
    expect(hd).toBeDefined();
    expect(hd?.source_snippet).toBe("Patient has a history of coronary artery disease");
    expect(hd?.source_index).toEqual([0, 48]);
  });

  it("extracts smoking history from keywords", () => {
    const text = "Cardiology consult. Patient is a former smoker who quit 2 years ago.";
    const insights = extractExplainableInsights(text);

    const sh = insights.find(i => i.insight === "Patient has a smoking history (former)");
    expect(sh).toBeDefined();
    expect(sh?.source_snippet).toBe("Patient is a former smoker who quit 2 years ago");
    expect(sh?.source_index).toEqual([20, 67]);
  });

  it("returns null snippet and index when no evidence is found in text", () => {
    const text = "Patient is standard. Normal checks. Routine follow up.";
    const insights = extractExplainableInsights(text);

    for (const insight of insights) {
      expect(insight.source_snippet).toBeNull();
      expect(insight.source_index).toBeNull();
    }
  });

  it("returns nulls if note text is empty", () => {
    const insights = extractExplainableInsights("");
    for (const insight of insights) {
      expect(insight.source_snippet).toBeNull();
      expect(insight.source_index).toBeNull();
    }
  });
});

describe("Explainable Insights Integration Tests", () => {
  const bundleWithClinicalNote = {
    resourceType: "Bundle",
    type: "collection",
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: "pat-999",
          name: [{ given: ["Bob"], family: "Jones" }],
          gender: "male",
          birthDate: "1975-05-05",
        },
      },
      {
        resource: {
          resourceType: "Observation",
          code: { coding: [{ code: "39156-5", display: "Body Mass Index" }] },
          valueQuantity: { value: 28.1 },
        },
      },
      {
        resource: {
          resourceType: "Observation",
          code: { coding: [{ code: "4548-4", display: "HbA1c" }] },
          valueQuantity: { value: 6.2 },
        },
      },
      {
        resource: {
          resourceType: "Observation",
          code: { coding: [{ code: "2339-0", display: "Blood Glucose" }] },
          valueQuantity: { value: 110 },
        },
      },
      {
        resource: {
          resourceType: "DocumentReference",
          description: "Clinical summary note",
          content: [
            {
              attachment: {
                data: Buffer.from("Vitals check. BP reading 145/95 noted. Quit smoking last year.").toString("base64"),
              },
            },
          ],
        },
      },
    ],
  };

  it("successfully parses clinical note and returns explainable insights in route response", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .post("/api/ingest/fhir")
      .send(bundleWithClinicalNote);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.clinical_note).toBe("Vitals check. BP reading 145/95 noted. Quit smoking last year.");
    expect(res.body.explainable_insights).toBeDefined();
    expect(res.body.explainable_insights.length).toBe(3);

    const ht = res.body.explainable_insights.find((i: any) => i.insight === "Patient shows signs of hypertension");
    expect(ht.source_snippet).toBe("BP reading 145/95 noted");
    expect(ht.source_index).toEqual([14, 37]);
  });
});
