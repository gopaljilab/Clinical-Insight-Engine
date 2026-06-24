/**
 * server/services/fhirParser.test.ts
 *
 * Unit tests for FHIR parsing functions in server/services/fhirParser.ts.
 *
 * Covers:
 *  - validateFhirBundle: valid/invalid FHIR Bundle structure
 *  - parseFhirBundle: Patient, Observation, DocumentReference extraction
 *  - parseFhirBundle: empty bundle handling
 *  - extractExplainableInsights: clinical note text analysis
 *  - extractExplainableInsights: empty text handling
 *  - convertToInternalSchema: valid full conversion
 *  - convertToInternalSchema: missing required fields throw
 */

import { describe, expect, it } from "vitest";
import {
  validateFhirBundle,
  parseFhirBundle,
  extractExplainableInsights,
  convertToInternalSchema,
} from "./fhirParser";
import type { NormalizedFhirStructure } from "./fhirParser";

describe("validateFhirBundle", () => {
  const validBundle = {
    resourceType: "Bundle",
    type: "collection",
    entry: [{ resource: { resourceType: "Patient", id: "p1" } }],
  };

  it("accepts a valid FHIR Bundle", () => {
    expect(() => validateFhirBundle(validBundle)).not.toThrow();
  });

  it("throws on null payload", () => {
    expect(() => validateFhirBundle(null)).toThrow("Invalid FHIR payload");
  });

  it("throws on non-object payload", () => {
    expect(() => validateFhirBundle("string")).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle(42)).toThrow("Invalid FHIR payload");
  });

  it("throws when resourceType is missing", () => {
    expect(() => validateFhirBundle({ type: "collection", entry: [] })).toThrow("Invalid FHIR payload");
  });

  it("throws when resourceType is not Bundle", () => {
    expect(() => validateFhirBundle({ resourceType: "Patient", entry: [] })).toThrow("Unsupported FHIR structure");
  });

  it("throws when type is missing", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", entry: [{}] })).toThrow("Unsupported FHIR structure");
  });

  it("throws when entry is missing", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", type: "collection" })).toThrow("Missing Bundle entries");
  });

  it("throws when entry is not an array", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: {} })).toThrow("Missing Bundle entries");
  });

  it("throws when entry is empty", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: [] })).toThrow("Missing Bundle entries");
  });
});

describe("parseFhirBundle", () => {
  it("extracts Patient resource with official name", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "p1",
            name: [{ use: "official", given: ["John"], family: "Doe" }],
            gender: "male",
            birthDate: "1980-05-15",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient).toBeDefined();
    expect(result.patient?.name).toBe("John Doe");
    expect(result.patient?.gender).toBe("Male");
    expect(result.patient?.id).toBe("p1");
    expect(result.patient?.birthDate).toBe("1980-05-15");
  });

  it("extracts Patient name using first name entry when official is absent", () => {
    const bundle = {
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
    const result = parseFhirBundle(bundle);
    expect(result.patient?.name).toBe("Jane Smith");
    expect(result.patient?.gender).toBe("Female");
  });

  it("maps gender female correctly", () => {
    const bundle = {
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
    const result = parseFhirBundle(bundle);
    expect(result.patient?.gender).toBe("Female");
  });

  it("skips non-FHIR resources gracefully", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [{ resource: { resourceType: "Unknown", id: "x1" } }],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient).toBeUndefined();
    expect(result.observations).toHaveLength(0);
    expect(result.documents).toHaveLength(0);
  });

  it("skips malformed entries gracefully", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        null,
        {},
        { resource: null },
        { resource: { resourceType: "Patient", name: [], gender: "male" } },
      ],
    };
    const result = parseFhirBundle(bundle);
    // Should not throw; Patient with empty name should have empty name
    expect(result.patient?.name).toBe("");
  });

  it("extracts Observation with valueQuantity", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "4548-4", display: "HbA1c" }] },
            effectiveDateTime: "2024-01-15",
            valueQuantity: { value: 7.5, unit: "%" },
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].code).toBe("4548-4");
    expect(result.observations[0].codeDisplay).toBe("HbA1c");
    expect(result.observations[0].valueQuantity?.value).toBe(7.5);
    expect(result.observations[0].valueQuantity?.unit).toBe("%");
  });

  it("extracts Observation with valueString", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { text: "Smoking Status" },
            valueString: "current smoker",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].valueString).toBe("current smoker");
  });

  it("extracts Observation components", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "85354-9", display: "Blood Pressure Panel" }] },
            component: [
              {
                code: { coding: [{ code: "8480-6", display: "Systolic BP" }] },
                valueQuantity: { value: 150 },
              },
            ],
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations[0].component).toHaveLength(1);
    expect(result.observations[0].component?.[0].valueQuantity?.value).toBe(150);
  });

  it("returns empty observations array on empty bundle", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations).toHaveLength(0);
    expect(result.documents).toHaveLength(0);
    expect(result.patient).toBeUndefined();
  });
});

describe("extractExplainableInsights", () => {
  it("returns default insights for empty text", () => {
    const insights = extractExplainableInsights("");
    expect(insights).toHaveLength(3);
    expect(insights[0].insight).toBe("Patient shows signs of hypertension");
    expect(insights[1].insight).toBe("Patient shows signs of heart disease");
    expect(insights[2].insight).toBe("Patient has a history of smoking");
    insights.forEach((i) => {
      expect(i.source_snippet).toBeNull();
      expect(i.source_index).toBeNull();
    });
  });

  it("detects hypertension from keyword", () => {
    const insights = extractExplainableInsights("Patient has hypertension.");
    const htInsight = insights.find((i) => i.insight.includes("hypertension"));
    expect(htInsight?.source_snippet).toMatch(/Patient has hypertension/i);
    expect(htInsight?.source_index).not.toBeNull();
  });

  it("detects heart disease from coronary artery keyword", () => {
    const insights = extractExplainableInsights("Patient has coronary artery disease.");
    const hdInsight = insights.find((i) => i.insight.includes("heart disease"));
    expect(hdInsight?.source_snippet).toMatch(/Patient has coronary artery disease/i);
  });

  it("detects heart disease from MI keyword", () => {
    const insights = extractExplainableInsights("History of myocardial infarction.");
    const hdInsight = insights.find((i) => i.insight.includes("heart disease"));
    expect(hdInsight?.source_snippet).toMatch(/History of myocardial infarction/i);
  });

  it("detects current smoker", () => {
    const insights = extractExplainableInsights("Patient is a current smoker.");
    const shInsight = insights.find((i) => i.insight.includes("smoking"));
    expect(shInsight?.insight).toContain("current");
  });

  it("detects former smoker", () => {
    const insights = extractExplainableInsights("Patient is a former smoker.");
    const shInsight = insights.find((i) => i.insight.includes("smoking"));
    expect(shInsight?.insight).toContain("former");
  });

  it("detects non-smoker", () => {
    const insights = extractExplainableInsights("Patient is a non-smoker.");
    const shInsight = insights.find((i) => i.insight.includes("smoking"));
    expect(shInsight?.insight).toContain("never");
  });

  it("returns null source_snippet when no keywords match", () => {
    const insights = extractExplainableInsights("Patient is healthy.");
    const shInsight = insights.find((i) => i.insight.includes("smoking"));
    expect(shInsight?.source_snippet).toBeNull();
  });
});

describe("convertToInternalSchema", () => {
  function makeMinimalStructure(overrides?: Partial<NormalizedFhirStructure>): NormalizedFhirStructure {
    return {
      patient: {
        name: "Test Patient",
        gender: "Male",
        birthDate: "1980-01-01",
      },
      observations: [
        {
          code: "39156-5",
          codeDisplay: "BMI",
          valueQuantity: { value: 25 },
        },
        {
          code: "4548-4",
          codeDisplay: "HbA1c",
          valueQuantity: { value: 6.5 },
        },
        {
          code: "2339-0",
          codeDisplay: "Glucose",
          valueQuantity: { value: 120 },
        },
      ],
      documents: [],
      ...overrides,
    };
  }

  it("converts a complete normalized structure to InsertAssessment", () => {
    const structure = makeMinimalStructure();
    const result = convertToInternalSchema(structure);
    expect(result.patientName).toBe("Test Patient");
    expect(result.gender).toBe("Male");
    expect(result.bmi).toBe(25);
    expect(result.hba1cLevel).toBe(6.5);
    expect(result.bloodGlucoseLevel).toBe(120);
  });

  it("throws when patient is missing", () => {
    const structure = { patient: undefined, observations: [], documents: [] };
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: Patient Name");
  });

  it("throws when patient name is missing", () => {
    const structure = makeMinimalStructure({ patient: { name: "", gender: "Male" } });
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: Patient Name");
  });

  it("throws when gender is missing", () => {
    const structure = makeMinimalStructure({ patient: { name: "Test", gender: undefined } });
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: Gender");
  });

  it("throws when birthDate is missing", () => {
    const structure = makeMinimalStructure({ patient: { name: "Test", gender: "Male" } });
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: Age");
  });

  it("throws when BMI observation is missing", () => {
    const structure = makeMinimalStructure({
      observations: [
        { code: "4548-4", codeDisplay: "HbA1c", valueQuantity: { value: 6.5 } },
        { code: "2339-0", codeDisplay: "Glucose", valueQuantity: { value: 120 } },
      ],
    });
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: BMI");
  });

  it("throws when HbA1c observation is missing", () => {
    const structure = makeMinimalStructure({
      observations: [
        { code: "39156-5", codeDisplay: "BMI", valueQuantity: { value: 25 } },
        { code: "2339-0", codeDisplay: "Glucose", valueQuantity: { value: 120 } },
      ],
    });
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: HbA1c Level");
  });

  it("throws when blood glucose observation is missing", () => {
    const structure = makeMinimalStructure({
      observations: [
        { code: "39156-5", codeDisplay: "BMI", valueQuantity: { value: 25 } },
        { code: "4548-4", codeDisplay: "HbA1c", valueQuantity: { value: 6.5 } },
      ],
    });
    expect(() => convertToInternalSchema(structure)).toThrow("Missing required field: Blood Glucose Level");
  });

  it("scans document text for hypertension to set hypertension=true", () => {
    const structure = makeMinimalStructure({
      documents: [{ description: "Patient has a history of hypertension." }],
    });
    const result = convertToInternalSchema(structure);
    expect(result.hypertension).toBe(true);
  });

  it("scans document text for smoking history", () => {
    const structure = makeMinimalStructure({
      documents: [{ description: "Patient is a former smoker." }],
    });
    const result = convertToInternalSchema(structure);
    expect(result.smokingHistory).toBe("former");
  });
});
