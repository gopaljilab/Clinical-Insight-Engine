import { describe, it, expect } from "vitest";
import {
  validateFhirBundle,
  parseFhirBundle,
  extractExplainableInsights,
  convertToInternalSchema,
} from "./fhirParser";

describe("validateFhirBundle", () => {
  it("accepts a valid FHIR R4 Bundle", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [{ resource: { resourceType: "Patient" } }],
    };
    expect(() => validateFhirBundle(bundle)).not.toThrow();
  });

  it("throws for null payload", () => {
    expect(() => validateFhirBundle(null)).toThrow("Invalid FHIR payload");
  });

  it("throws for non-object payload", () => {
    expect(() => validateFhirBundle("string")).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle(123)).toThrow("Invalid FHIR payload");
  });

  it("throws when resourceType is missing", () => {
    expect(() => validateFhirBundle({ type: "collection" })).toThrow("Invalid FHIR payload");
  });

  it("throws for non-Bundle resourceType", () => {
    const bundle = {
      resourceType: "Patient",
      type: "collection",
      entry: [],
    };
    expect(() => validateFhirBundle(bundle)).toThrow("Unsupported FHIR structure");
  });

  it("throws when type is missing", () => {
    const bundle = {
      resourceType: "Bundle",
      entry: [],
    };
    expect(() => validateFhirBundle(bundle)).toThrow("Unsupported FHIR structure");
  });

  it("throws when entry is missing", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
    };
    expect(() => validateFhirBundle(bundle)).toThrow("Missing Bundle entries");
  });

  it("throws when entry is not an array", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: "not-an-array",
    };
    expect(() => validateFhirBundle(bundle)).toThrow("Missing Bundle entries");
  });

  it("throws when entry is empty array", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [],
    };
    expect(() => validateFhirBundle(bundle)).toThrow("Missing Bundle entries");
  });
});

describe("parseFhirBundle", () => {
  it("parses a bundle with a Patient resource", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["John"], family: "Doe" }],
            gender: "male",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient).toBeDefined();
    expect(result.observations).toBeDefined();
    expect(Array.isArray(result.observations)).toBe(true);
    expect(result.documents).toBeDefined();
  });

  it("parses a bundle with an Observation resource", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { text: "HbA1c" },
            valueQuantity: { value: 7.5, unit: "%" },
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations.length).toBeGreaterThan(0);
  });

  it("returns empty arrays for bundle with no parseable entries", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "UnknownType",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations).toEqual([]);
    expect(result.documents).toEqual([]);
  });
});

describe("extractExplainableInsights", () => {
  it("extracts insights from clinical note text", () => {
    const text = "Patient has elevated blood glucose levels. HbA1c is 8.5.";
    const insights = extractExplainableInsights(text);
    expect(Array.isArray(insights)).toBe(true);
  });

  it("handles empty string", () => {
    const insights = extractExplainableInsights("");
    expect(Array.isArray(insights)).toBe(true);
  });

  it("handles null or undefined text", () => {
    expect(() => extractExplainableInsights(null as any)).not.toThrow();
    expect(() => extractExplainableInsights(undefined as any)).not.toThrow();
  });

  it("returns insight objects with expected shape", () => {
    const insights = extractExplainableInsights(
      "Patient presents with high blood pressure and elevated HbA1c"
    );
    insights.forEach((insight) => {
      expect(typeof insight).toBe("object");
    });
  });
});

describe("convertToInternalSchema", () => {
  function makeObservation(code: string, value: number, display = "") {
    return {
      code,
      codeDisplay: display,
      valueQuantity: { value, unit: "%" },
    };
  }

  it("converts valid normalized FHIR structure to InsertAssessment", () => {
    const normalized = {
      patient: { name: "Jane Doe", gender: "Female" as const, birthDate: "1985-06-15" },
      observations: [
        makeObservation("BMI", 25.5, "Body Mass Index"),
        makeObservation("HbA1c", 6.5, "Hemoglobin A1c"),
        makeObservation("Glucose", 120, "Blood Glucose"),
      ],
      documents: [],
    };
    expect(() => convertToInternalSchema(normalized)).not.toThrow();
  });

  it("throws when patient is missing", () => {
    const normalized = { observations: [], documents: [] } as any;
    expect(() => convertToInternalSchema(normalized)).toThrow("Missing required field: Patient Name");
  });

  it("throws when patient name is missing", () => {
    const normalized = {
      patient: { gender: "Female" as const, birthDate: "1985-06-15" },
      observations: [],
      documents: [],
    } as any;
    expect(() => convertToInternalSchema(normalized)).toThrow("Missing required field: Patient Name");
  });

  it("throws when gender is not Male or Female", () => {
    const normalized = {
      patient: { name: "Test", gender: "Unknown" as any, birthDate: "1985-06-15" },
      observations: [],
      documents: [],
    };
    expect(() => convertToInternalSchema(normalized)).toThrow("Gender must be 'Male' or 'Female'");
  });

  it("throws when birthDate is missing", () => {
    const normalized = {
      patient: { name: "Test", gender: "Male" as const },
      observations: [],
      documents: [],
    } as any;
    expect(() => convertToInternalSchema(normalized)).toThrow("Missing required field: Age");
  });

  it("throws for invalid birth date format", () => {
    const normalized = {
      patient: { name: "Test", gender: "Male" as const, birthDate: "invalid-date" },
      observations: [],
      documents: [],
    };
    expect(() => convertToInternalSchema(normalized)).toThrow("Invalid birth date format");
  });

  it("throws when BMI is missing from observations", () => {
    const normalized = {
      patient: { name: "Test Patient", gender: "Female" as const, birthDate: "1985-06-15" },
      observations: [
        makeObservation("HbA1c", 6.5, "Hemoglobin A1c"),
        makeObservation("Glucose", 120, "Blood Glucose"),
      ],
      documents: [],
    };
    expect(() => convertToInternalSchema(normalized)).toThrow("Missing required field: BMI");
  });

  it("throws when HbA1c is missing from observations", () => {
    const normalized = {
      patient: { name: "Test Patient", gender: "Female" as const, birthDate: "1985-06-15" },
      observations: [
        makeObservation("BMI", 25.5, "Body Mass Index"),
        makeObservation("Glucose", 120, "Blood Glucose"),
      ],
      documents: [],
    };
    expect(() => convertToInternalSchema(normalized)).toThrow("Missing required field: HbA1c Level");
  });

  it("throws when Blood Glucose is missing from observations", () => {
    const normalized = {
      patient: { name: "Test Patient", gender: "Female" as const, birthDate: "1985-06-15" },
      observations: [
        makeObservation("BMI", 25.5, "Body Mass Index"),
        makeObservation("HbA1c", 6.5, "Hemoglobin A1c"),
      ],
      documents: [],
    };
    expect(() => convertToInternalSchema(normalized)).toThrow("Missing required field: Blood Glucose Level");
  });
});
