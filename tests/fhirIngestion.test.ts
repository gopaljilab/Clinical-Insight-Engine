import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";
import {
  validateFhirBundle,
  parseFhirBundle,
  convertToInternalSchema,
} from "../server/services/fhirParser";

// 1. Mock MLService directly to isolate routes from Python ML daemon
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

// 2. Mock database storage layer
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

// Helper to create authenticated Express app
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

// Helper to create unauthenticated Express app
function createUnauthenticatedApp() {
  const app = express();
  app.use(express.json());
  return app;
}

// Mock ML pipeline daemon output
const pythonSuccessOutput = JSON.stringify({
  requestId: "some-uuid",
  prediction: {
    riskScore: 12.3,
    riskCategory: "LOW",
    factors: [{ name: "Age", impact: "positive", description: "Increases risk" }],
    clinicianAdvice: ["Monitor annually."],
    patientAdvice: ["Keep it up!"],
    confidenceInterval: "8.5% - 16.1%",
    modelConfidence: 0.877,
  }
});

// Sample valid FHIR Bundle
const validFhirBundle = {
  resourceType: "Bundle",
  type: "collection",
  entry: [
    {
      resource: {
        resourceType: "Patient",
        id: "pat-123",
        name: [
          {
            use: "official",
            given: ["John", "Edward"],
            family: "Smith",
          },
        ],
        gender: "male",
        birthDate: "1980-01-01",
      },
    },
    {
      resource: {
        resourceType: "Observation",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "39156-5",
              display: "Body Mass Index",
            },
          ],
        },
        valueQuantity: {
          value: 24.5,
          unit: "kg/m2",
        },
      },
    },
    {
      resource: {
        resourceType: "Observation",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "4548-4",
              display: "Hemoglobin A1c",
            },
          ],
        },
        valueQuantity: {
          value: 5.4,
          unit: "%",
        },
      },
    },
    {
      resource: {
        resourceType: "Observation",
        code: {
          coding: [
            {
              system: "http://loinc.org",
              code: "2339-0",
              display: "Blood Glucose",
            },
          ],
        },
        valueQuantity: {
          value: 95,
          unit: "mg/dL",
        },
      },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateAssessment.mockImplementation((input) =>
    Promise.resolve({ id: 1, ...input, createdAt: new Date() })
  );
  mockRunAssessmentInference.mockResolvedValue({
    prediction: {
      riskScore: 12.3,
      riskCategory: "LOW",
      factors: [{ name: "Age", impact: "positive", description: "Increases risk" }],
      clinicianAdvice: ["Monitor annually."],
      patientAdvice: ["Keep it up!"],
      confidenceInterval: "8.5% - 16.1%",
      modelConfidence: 0.877,
    },
    isFallback: false,
  });
});

describe("FHIR Parser Unit Tests", () => {
  describe("validateFhirBundle", () => {
    it("throws for null or empty payload", () => {
      expect(() => validateFhirBundle(null)).toThrow("Invalid FHIR payload");
      expect(() => validateFhirBundle({})).toThrow("Invalid FHIR payload");
    });

    it("throws for unsupported resourceType", () => {
      expect(() => validateFhirBundle({ resourceType: "Patient" })).toThrow("Unsupported FHIR structure");
    });

    it("throws for missing entry list", () => {
      expect(() => validateFhirBundle({ resourceType: "Bundle", type: "collection" })).toThrow("Missing Bundle entries");
      expect(() => validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: [] })).toThrow("Missing Bundle entries");
    });
  });

  describe("parseFhirBundle", () => {
    it("successfully parses Patient details", () => {
      const parsed = parseFhirBundle(validFhirBundle);
      expect(parsed.patient).toBeDefined();
      expect(parsed.patient?.id).toBe("pat-123");
      expect(parsed.patient?.name).toBe("John Edward Smith");
      expect(parsed.patient?.gender).toBe("Male");
      expect(parsed.patient?.birthDate).toBe("1980-01-01");
    });

    it("successfully parses Observations", () => {
      const parsed = parseFhirBundle(validFhirBundle);
      expect(parsed.observations.length).toBe(3);
      expect(parsed.observations[0].codeDisplay).toBe("Body Mass Index");
      expect(parsed.observations[0].valueQuantity?.value).toBe(24.5);
    });

    it("ignores unsupported resources", () => {
      const bundleWithMedication = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          ...validFhirBundle.entry,
          {
            resource: {
              resourceType: "MedicationRequest",
              id: "med-1",
            },
          },
        ],
      };
      const parsed = parseFhirBundle(bundleWithMedication);
      expect(parsed.patient?.name).toBe("John Edward Smith");
      expect(parsed.observations.length).toBe(3);
    });

    it("successfully parses DocumentReferences with base64 content", () => {
      const bundleWithDoc = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          {
            resource: {
              resourceType: "DocumentReference",
              description: "Clinical summary note",
              type: {
                text: "Discharge summary",
              },
              content: [
                {
                  attachment: {
                    title: "Summary attachment",
                    data: Buffer.from("Patient has history of hypertension and former smoker.").toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      };
      const parsed = parseFhirBundle(bundleWithDoc);
      expect(parsed.documents.length).toBe(1);
      expect(parsed.documents[0].description).toBe("Clinical summary note");
      expect(parsed.documents[0].attachmentTitle).toBe("Summary attachment");
      expect(parsed.documents[0].attachmentContent).toContain("hypertension and former smoker");
    });
  });

  describe("convertToInternalSchema", () => {
    it("converts valid FHIR structure to InsertAssessment and validates age", () => {
      const parsed = parseFhirBundle(validFhirBundle);
      const assessment = convertToInternalSchema(parsed);

      expect(assessment.patientName).toBe("John Edward Smith");
      expect(assessment.gender).toBe("Male");
      expect(assessment.bmi).toBe(24.5);
      expect(assessment.hba1cLevel).toBe(5.4);
      expect(assessment.bloodGlucoseLevel).toBe(95);
      expect(assessment.hypertension).toBe(false);
      expect(assessment.heartDisease).toBe(false);
      expect(assessment.smokingHistory).toBe("No Info");
    });

    it("computes hypertension and heart disease flags from document content keywords", () => {
      const parsed = parseFhirBundle(validFhirBundle);
      parsed.documents.push({
        attachmentContent: "Patient diagnosed with hypertension and congestive heart failure. Also a former smoker.",
      });

      const assessment = convertToInternalSchema(parsed);
      expect(assessment.hypertension).toBe(true);
      expect(assessment.heartDisease).toBe(true);
      expect(assessment.smokingHistory).toBe("former");
    });

    it("computes hypertension flags from blood pressure observation component vitals", () => {
      const parsed = parseFhirBundle(validFhirBundle);
      parsed.observations.push({
        codeDisplay: "Blood Pressure Vitals",
        code: "85354-9",
        component: [
          {
            code: { coding: [{ code: "8480-6", display: "Systolic Blood Pressure" }] },
            valueQuantity: { value: 145 },
          },
          {
            code: { coding: [{ code: "8462-4", display: "Diastolic Blood Pressure" }] },
            valueQuantity: { value: 85 },
          },
        ],
      });

      const assessment = convertToInternalSchema(parsed);
      expect(assessment.hypertension).toBe(true);
    });

    it("throws detailed validation errors for missing patient name", () => {
      const parsed = parseFhirBundle(validFhirBundle);
      if (parsed.patient) parsed.patient.name = "";
      expect(() => convertToInternalSchema(parsed)).toThrow("Missing required field: Patient Name");
    });

    it("throws detailed validation errors for missing BMI", () => {
      const parsed = parseFhirBundle(validFhirBundle);
      parsed.observations = parsed.observations.filter(o => !o.codeDisplay?.includes("Index"));
      expect(() => convertToInternalSchema(parsed)).toThrow("Missing required field: BMI");
    });
  });
});

describe("FHIR Ingestion Router Integration Tests", () => {
  it("returns 401 for unauthenticated request", async () => {
    const app = createUnauthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .post("/api/ingest/fhir")
      .send(validFhirBundle);

    expect(res.status).toBe(401);
  });

  it("returns 400 when submitting invalid JSON structure", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .post("/api/ingest/fhir")
      .send({ invalid: "payload" });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toBe("Invalid FHIR payload");
  });

  it("returns 400 when required clinical data is missing", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const incompleteBundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["Bob"], family: "Johnson" }],
            gender: "male",
            birthDate: "1995-10-10",
          },
        },
      ],
    };

    const res = await request(app)
      .post("/api/ingest/fhir")
      .send(incompleteBundle);

    expect(res.status).toBe(400);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toContain("Missing required field");
  });

  it("returns 200 and synchronous insights on successful ingestion", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    const res = await request(app)
      .post("/api/ingest/fhir")
      .send(validFhirBundle);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.patient_id).toBe("pat-123");
    expect(res.body.observations_processed).toBe(3);
    expect(res.body.documents_processed).toBe(0);

    const riskInsight = res.body.insights.find((i: any) => i.type === "risk");
    expect(riskInsight).toBeDefined();
    expect(riskInsight.category).toBe("LOW");
    expect(riskInsight.score).toBe(12.3);
  });

  it("returns 500 when processing throws an error in the pipeline", async () => {
    const app = createAuthenticatedApp();
    await registerRoutes(createServer(), app);

    mockCreateAssessment.mockRejectedValueOnce(new Error("Database write failure"));

    const res = await request(app)
      .post("/api/ingest/fhir")
      .send(validFhirBundle);

    expect(res.status).toBe(500);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toContain("Database write failure");
  });
});
