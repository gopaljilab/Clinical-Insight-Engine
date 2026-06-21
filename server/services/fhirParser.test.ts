/**
 * Unit tests for server/services/fhirParser.ts
 * Covers FHIR R4 Bundle validation, parsing, and internal schema conversion.
 */
import { describe, expect, it, beforeEach } from "vitest";
import {
  validateFhirBundle,
  parseFhirBundle,
  convertToInternalSchema,
  extractExplainableInsights,
  type NormalizedFhirStructure,
} from "./fhirParser";

// ─── validateFhirBundle Tests ────────────────────────────────────────────────

describe("validateFhirBundle", () => {
  it("accepts a valid FHIR R4 Bundle", () => {
    const payload = {
      resourceType: "Bundle",
      type: "collection",
      entry: [{ resource: { resourceType: "Patient", id: "p1" } }],
    };
    expect(() => validateFhirBundle(payload)).not.toThrow();
  });

  it("throws for null payload", () => {
    expect(() => validateFhirBundle(null)).toThrow("Invalid FHIR payload");
  });

  it("throws for undefined payload", () => {
    expect(() => validateFhirBundle(undefined)).toThrow("Invalid FHIR payload");
  });

  it("throws for non-object payload", () => {
    expect(() => validateFhirBundle("string")).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle(123)).toThrow("Invalid FHIR payload");
  });

  it("throws when resourceType is missing", () => {
    expect(() => validateFhirBundle({ type: "collection", entry: [] })).toThrow("Invalid FHIR payload");
  });

  it("throws when resourceType is not Bundle", () => {
    expect(() => validateFhirBundle({ resourceType: "Patient", entry: [] })).toThrow("Unsupported FHIR structure");
  });

  it("throws when type is missing or not a string", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", entry: [] })).toThrow("Unsupported FHIR structure");
    expect(() => validateFhirBundle({ resourceType: "Bundle", type: 123, entry: [] })).toThrow("Unsupported FHIR structure");
  });

  it("throws when entry is missing", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", type: "collection" })).toThrow("Missing Bundle entries");
  });

  it("throws when entry is not an array", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: "not-array" })).toThrow("Missing Bundle entries");
  });

  it("throws when entry is empty", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: [] })).toThrow("Missing Bundle entries");
  });
});

// ─── parseFhirBundle Tests ───────────────────────────────────────────────────

describe("parseFhirBundle", () => {
  it("parses a Patient resource", () => {
    const payload = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "p123",
            name: [{ use: "official", given: ["John"], family: "Doe" }],
            gender: "male",
            birthDate: "1980-05-15",
          },
        },
      ],
    };
    const result = parseFhirBundle(payload);
    expect(result.patient).toBeTruthy();
    expect(result.patient.name).toBe("John Doe");
    expect(result.patient.gender).toBe("Male");
    expect(result.patient.id).toBe("p123");
    expect(result.patient.birthDate).toBe("1980-05-15");
  });

  it("parses a Patient resource with female gender", () => {
    const payload = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["Jane"], family: "Smith" }],
            gender: "female",
          },
        },
      ],
    };
    const result = parseFhirBundle(payload);
    expect(result.patient.gender).toBe("Female");
  });

  it("skips malformed entries gracefully", () => {
    const payload = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        null,
        { resource: null },
        { resource: { resourceType: "Unknown" } },
        { resource: { resourceType: "Patient", name: [{ given: ["Alice"] }], gender: "female" } },
      ],
    };
    const result = parseFhirBundle(payload);
    expect(result.patient.name).toBe("Alice");
    expect(result.observations).toHaveLength(0);
  });

  it("parses an Observation with valueQuantity", () => {
    const payload = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "39156-5", display: "Body mass index" }] },
            effectiveDateTime: "2024-01-15",
            valueQuantity: { value: 24.5, unit: "kg/m2" },
          },
        },
      ],
    };
    const result = parseFhirBundle(payload);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].code).toBe("39156-5");
    expect(result.observations[0].codeDisplay).toBe("Body mass index");
    expect(result.observations[0].valueQuantity.value).toBe(24.5);
    expect(result.observations[0].valueQuantity.unit).toBe("kg/m2");
  });

  it("parses an Observation with valueString", () => {
    const payload = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { text: "Hypertension status" },
            valueString: "active",
          },
        },
      ],
    };
    const result = parseFhirBundle(payload);
    expect(result.observations[0].valueString).toBe("active");
  });

  it("parses Observation with components", () => {
    const payload = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "85354-9" }] },
            component: [
              { code: { coding: [{ code: "8480-6", display: "Systolic blood pressure" }] }, valueQuantity: { value: 150 } },
              { code: { coding: [{ code: "8462-4", display: "Diastolic blood pressure" }] }, valueQuantity: { value: 95 } },
            ],
          },
        },
      ],
    };
    const result = parseFhirBundle(payload);
    expect(result.observations[0].component).toHaveLength(2);
    expect(result.observations[0].component[0].valueQuantity.value).toBe(150);
    expect(result.observations[0].component[1].valueQuantity.value).toBe(95);
  });

  it("parses a DocumentReference resource", () => {
    const payload = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "DocumentReference",
            description: "Clinical note",
            type: { text: "Progress Note" },
            content: [{ attachment: { title: "Note.txt", data: "SGVsbG8gV29ybGQ=" } }], // base64 "Hello World"
          },
        },
      ],
    };
    const result = parseFhirBundle(payload);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].description).toBe("Clinical note");
    expect(result.documents[0].type).toBe("Progress Note");
    expect(result.documents[0].attachmentTitle).toBe("Note.txt");
    expect(result.documents[0].attachmentContent).toBe("Hello World");
  });

  it("returns empty patient when no Patient resource is present", () => {
    const payload = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { text: "BMI" },
            valueQuantity: { value: 25 },
          },
        },
      ],
    };
    const result = parseFhirBundle(payload);
    expect(result.patient).toBeUndefined();
    expect(result.observations).toHaveLength(1);
  });
});

// ─── convertToInternalSchema Tests ──────────────────────────────────────────

describe("convertToInternalSchema", () => {
  function makeStructure(overrides = {}) {
    const structure: NormalizedFhirStructure = {
      patient: {
        id: "p1",
        name: "Test Patient",
        gender: "Male",
        birthDate: "1980-05-15",
      },
      observations: [
        {
          codeDisplay: "Body mass index",
          code: "39156-5",
          valueQuantity: { value: 24.5 },
        },
        {
          codeDisplay: "Hemoglobin A1c",
          code: "4548-4",
          valueQuantity: { value: 5.5 },
        },
        {
          codeDisplay: "Blood glucose",
          code: "2339-0",
          valueQuantity: { value: 95 },
        },
      ],
      documents: [],
      ...overrides,
    };
    return structure;
  }

  it("converts a valid FHIR structure to InsertAssessment", () => {
    const structure = makeStructure();
    const result = convertToInternalSchema(structure);
    expect(result.patientName).toBe("Test Patient");
    expect(result.gender).toBe("Male");
    expect(result.age).toBeGreaterThanOrEqual(40);
    expect(result.bmi).toBe(24.5);
    expect(result.hba1cLevel).toBe(5.5);
    expect(result.bloodGlucoseLevel).toBe(95);
  });

  it("throws when patient is missing", () => {
    const structure = { patient: undefined, observations: [], documents: [] };
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: Patient Name");
  });

  it("throws when patient name is missing", () => {
    const structure = makeStructure({ patient: { name: "", gender: "Male", birthDate: "1980-05-15" } });
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: Patient Name");
  });

  it("throws when gender is missing", () => {
    const structure = makeStructure({ patient: { name: "Test", gender: undefined, birthDate: "1980-05-15" } });
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: Gender");
  });

  it("throws when gender is invalid", () => {
    const structure = makeStructure({ patient: { name: "Test", gender: "Other", birthDate: "1980-05-15" } });
    expect(() => convertToInternalSchema(structure)).toThrow("Gender must be 'Male' or 'Female'");
  });

  it("throws when birthDate is missing", () => {
    const structure = makeStructure({ patient: { name: "Test", gender: "Male", birthDate: undefined } });
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: Age");
  });

  it("throws when BMI is missing from observations", () => {
    const structure = makeStructure({
      observations: [
        { codeDisplay: "HbA1c", code: "4548-4", valueQuantity: { value: 5.5 } },
        { codeDisplay: "glucose", code: "2339-0", valueQuantity: { value: 95 } },
      ],
    });
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: BMI");
  });

  it("extracts hypertension from BP component observations", () => {
    const structure = makeStructure({
      observations: [
        ...makeStructure().observations,
        {
          codeDisplay: "blood pressure panel",
          code: "85354-9",
          component: [
            { code: { coding: [{ code: "8480-6", display: "Systolic" }] }, valueQuantity: { value: 155 } },
            { code: { coding: [{ code: "8462-4", display: "Diastolic" }] }, valueQuantity: { value: 95 } },
          ],
        },
      ],
    });
    const result = convertToInternalSchema(structure);
    expect(result.hypertension).toBe(true);
  });

  it("sets heartDisease from observation display text", () => {
    const structure = makeStructure({
      observations: [
        ...makeStructure().observations,
        { codeDisplay: "heart disease status", valueString: "active" },
      ],
    });
    const result = convertToInternalSchema(structure);
    expect(result.heartDisease).toBe(true);
  });
});

// ─── extractExplainableInsights Tests ───────────────────────────────────────

describe("extractExplainableInsights", () => {
  it("returns default insights for empty note", () => {
    const insights = extractExplainableInsights("");
    expect(insights).toHaveLength(3);
    expect(insights[0].insight).toBe("Patient shows signs of hypertension");
    expect(insights[0].source_snippet).toBeNull();
  });

  it("extracts hypertension from BP reading in note", () => {
    const insights = extractExplainableInsights("Patient BP reading is 150/95 mmHg today.");
    const htInsight = insights.find(i => i.insight.includes("hypertension"));
    expect(htInsight.source_snippet).toBe("Patient BP reading is 150/95 mmHg today");
  });

  it("extracts heart disease from keyword match", () => {
    const insights = extractExplainableInsights("Patient has a history of coronary artery disease.");
    const hdInsight = insights.find(i => i.insight.includes("heart disease"));
    expect(hdInsight.source_snippet).toContain("coronary artery disease");
  });

  it("extracts smoking history (current)", () => {
    const insights = extractExplainableInsights("Patient is a current smoker, smokes 10 cigarettes daily.");
    const shInsight = insights.find(i => i.insight.includes("smoking history"));
    expect(shInsight.insight).toContain("current");
  });

  it("extracts smoking history (former)", () => {
    const insights = extractExplainableInsights("Patient is a former smoker who quit 5 years ago.");
    const shInsight = insights.find(i => i.insight.includes("smoking history"));
    expect(shInsight.insight).toContain("former");
  });
});