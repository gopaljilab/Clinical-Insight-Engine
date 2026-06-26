import { describe, it, expect } from "vitest";
import {
  validateFhirBundle,
  parseFhirBundle,
  extractExplainableInsights,
  convertToInternalSchema,
  type NormalizedFhirStructure,
} from "./fhirParser";

describe("validateFhirBundle", () => {
  it("accepts a valid FHIR R4 Bundle", () => {
    expect(() =>
      validateFhirBundle({
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: { resourceType: "Patient" } }],
      })
    ).not.toThrow();
  });

  it("throws for non-object payload", () => {
    expect(() => validateFhirBundle(null)).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle(undefined)).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle("string")).toThrow("Invalid FHIR payload");
  });

  it("throws for missing resourceType", () => {
    expect(() => validateFhirBundle({ type: "collection", entry: [] })).toThrow(
      "Invalid FHIR payload"
    );
  });

  it("throws for unsupported resourceType", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Patient", entry: [] })
    ).toThrow("Unsupported FHIR structure");
  });

  it("throws for missing type field", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", entry: [] })
    ).toThrow("Unsupported FHIR structure");
  });

  it("throws for missing or empty entry", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection" })
    ).toThrow("Missing Bundle entries");
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: [] })
    ).toThrow("Missing Bundle entries");
  });
});

describe("parseFhirBundle", () => {
  it("parses a Patient resource", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "patient-123",
            name: [{ use: "official", given: ["John"], family: "Doe" }],
            gender: "male",
            birthDate: "1980-05-15",
          },
        },
      ],
    };

    const result = parseFhirBundle(bundle);
    expect(result.patient).toBeDefined();
    expect(result.patient?.id).toBe("patient-123");
    expect(result.patient?.name).toBe("John Doe");
    expect(result.patient?.gender).toBe("Male");
    expect(result.patient?.birthDate).toBe("1980-05-15");
  });

  it("parses a Patient resource with female gender", () => {
    const bundle: any = {
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

  it("parses Observation with valueQuantity", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "4548-4", display: "HbA1c" }] },
            effectiveDateTime: "2024-01-10",
            valueQuantity: { value: 6.5, unit: "%" },
          },
        },
      ],
    };

    const result = parseFhirBundle(bundle);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].code).toBe("4548-4");
    expect(result.observations[0].codeDisplay).toBe("HbA1c");
    expect(result.observations[0].valueQuantity?.value).toBe(6.5);
    expect(result.observations[0].effectiveDateTime).toBe("2024-01-10");
  });

  it("parses Observation with valueString", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { text: "Status" },
            valueString: "Active",
          },
        },
      ],
    };

    const result = parseFhirBundle(bundle);
    expect(result.observations[0].valueString).toBe("Active");
  });

  it("parses Observation with components", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "85354-9" }] },
            component: [
              {
                code: { coding: [{ code: "8480-6", display: "Systolic" }] },
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

  it("skips unknown resource types gracefully", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        { resource: { resourceType: "Unknown" } },
        { resource: null },
        { resource: "string" },
      ],
    };

    const result = parseFhirBundle(bundle);
    expect(result.observations).toHaveLength(0);
    expect(result.documents).toHaveLength(0);
  });

  it("parses DocumentReference", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "DocumentReference",
            description: "Clinical note",
            type: { text: "Progress Note" },
            content: [{ attachment: { title: "note.pdf", data: "SGVsbG8=" } }],
          },
        },
      ],
    };

    const result = parseFhirBundle(bundle);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].description).toBe("Clinical note");
    expect(result.documents[0].type).toBe("Progress Note");
    expect(result.documents[0].attachmentTitle).toBe("note.pdf");
    expect(result.documents[0].attachmentContent).toBe("Hello");
  });
});

describe("extractExplainableInsights", () => {
  it("returns default insights for empty input", () => {
    const insights = extractExplainableInsights("");
    expect(insights).toHaveLength(3);
    expect(insights[0].insight).toBe("Patient shows signs of hypertension");
    expect(insights[1].insight).toBe("Patient shows signs of heart disease");
    expect(insights[2].insight).toBe("Patient has a history of smoking");
  });

  it("extracts hypertension from BP reading with elevated systolic", () => {
    const text = "Patient BP: 150/95 mmHg on admission.";
    const insights = extractExplainableInsights(text);
    const htInsight = insights.find((i) =>
      i.insight.includes("hypertension")
    );
    expect(htInsight?.source_snippet).toBeTruthy();
    expect(htInsight?.source_index).toBeTruthy();
  });

  it("extracts hypertension from BP reading with elevated diastolic", () => {
    const text = "Reading: 120/95. Slightly elevated.";
    const insights = extractExplainableInsights(text);
    const htInsight = insights.find((i) =>
      i.insight.includes("hypertension")
    );
    expect(htInsight?.source_snippet).toBeTruthy();
  });

  it("extracts hypertension from keyword", () => {
    const text = "Patient has a history of hypertension.";
    const insights = extractExplainableInsights(text);
    const htInsight = insights.find((i) =>
      i.insight.includes("hypertension")
    );
    expect(htInsight?.source_snippet).toBe("Patient has a history of hypertension");
  });

  it("extracts heart disease from CAD keyword", () => {
    const text = "Coronary artery disease confirmed on angiography.";
    const insights = extractExplainableInsights(text);
    const hdInsight = insights.find((i) =>
      i.insight.includes("heart disease")
    );
    expect(hdInsight?.source_snippet).toBeTruthy();
  });

  it("extracts heart disease from MI keyword", () => {
    const text = "History of MI in 2020.";
    const insights = extractExplainableInsights(text);
    const hdInsight = insights.find((i) =>
      i.insight.includes("heart disease")
    );
    expect(hdInsight?.source_snippet).toBeTruthy();
  });

  it("extracts current smoker status", () => {
    const text = "Patient is a current smoker, 1 pack per day.";
    const insights = extractExplainableInsights(text);
    const shInsight = insights.find((i) => i.insight.includes("smoking"));
    expect(shInsight?.insight).toContain("current");
  });

  it("extracts former smoker status", () => {
    const text = "Former smoker, quit 5 years ago.";
    const insights = extractExplainableInsights(text);
    const shInsight = insights.find((i) => i.insight.includes("smoking"));
    expect(shInsight?.insight).toContain("former");
  });

  it("extracts never smoker status", () => {
    const text = "Patient is a non-smoker with no tobacco history.";
    const insights = extractExplainableInsights(text);
    const shInsight = insights.find((i) => i.insight.includes("smoking"));
    expect(shInsight?.insight).toContain("never");
  });
});

describe("convertToInternalSchema", () => {
  function makeMinimalStructure(overrides: any = {}): NormalizedFhirStructure {
    return {
      patient: {
        id: "p-1",
        name: "Test Patient",
        gender: "Male",
        birthDate: "1980-06-15",
      },
      observations: [
        {
          codeDisplay: "BMI",
          code: "39156-5",
          valueQuantity: { value: 28.5 },
        },
        {
          codeDisplay: "HbA1c",
          code: "4548-4",
          valueQuantity: { value: 6.2 },
        },
        {
          codeDisplay: "Blood Glucose",
          code: "2339-0",
          valueQuantity: { value: 110 },
        },
      ],
      documents: [],
      ...overrides,
    };
  }

  it("converts a valid structure to InsertAssessment schema", () => {
    const structure = makeMinimalStructure();
    const result = convertToInternalSchema(structure);
    expect(result.patientName).toBe("Test Patient");
    expect(result.gender).toBe("Male");
    expect(result.age).toBeGreaterThan(0);
    expect(result.bmi).toBe(28.5);
    expect(result.hba1cLevel).toBe(6.2);
    expect(result.bloodGlucoseLevel).toBe(110);
  });

  it("throws for missing patient", () => {
    const structure = makeMinimalStructure({ patient: undefined });
    expect(() => convertToInternalSchema(structure)).toThrow(
      "Missing required field: Patient Name"
    );
  });

  it("throws for missing patient name", () => {
    const structure = makeMinimalStructure({
      patient: { name: "", gender: "Male", birthDate: "1980-06-15" },
    });
    expect(() => convertToInternalSchema(structure)).toThrow(
      "Missing required field: Patient Name"
    );
  });

  it("throws for missing gender", () => {
    const structure = makeMinimalStructure({
      patient: { name: "Test", gender: undefined, birthDate: "1980-06-15" },
    });
    expect(() => convertToInternalSchema(structure)).toThrow(
      "Missing required field: Gender"
    );
  });

  it("throws for invalid gender value", () => {
    const structure = makeMinimalStructure({
      patient: { name: "Test", gender: "Unknown", birthDate: "1980-06-15" },
    });
    expect(() => convertToInternalSchema(structure)).toThrow(
      "Gender must be 'Male' or 'Female'"
    );
  });

  it("throws for missing birthDate", () => {
    const structure = makeMinimalStructure({
      patient: { name: "Test", gender: "Male" },
    });
    expect(() => convertToInternalSchema(structure)).toThrow(
      "Missing required field: Age"
    );
  });

  it("throws for invalid birthDate format", () => {
    const structure = makeMinimalStructure({
      patient: { name: "Test", gender: "Male", birthDate: "not-a-date" },
    });
    expect(() => convertToInternalSchema(structure)).toThrow("Invalid birth date format");
  });

  it("throws for age out of range (>120)", () => {
    const structure = makeMinimalStructure({
      patient: { name: "Test", gender: "Male", birthDate: "1800-01-01" },
    });
    expect(() => convertToInternalSchema(structure)).toThrow(
      "Age must be between 1 and 120"
    );
  });

  it("throws for missing BMI observation", () => {
    const structure = makeMinimalStructure({
      observations: [
        {
          codeDisplay: "HbA1c",
          code: "4548-4",
          valueQuantity: { value: 6.2 },
        },
        {
          codeDisplay: "Blood Glucose",
          code: "2339-0",
          valueQuantity: { value: 110 },
        },
      ],
    });
    expect(() => convertToInternalSchema(structure)).toThrow(
      "Missing required field: BMI"
    );
  });

  it("throws for missing HbA1c observation", () => {
    const structure = makeMinimalStructure({
      observations: [
        {
          codeDisplay: "BMI",
          code: "39156-5",
          valueQuantity: { value: 28.5 },
        },
        {
          codeDisplay: "Blood Glucose",
          code: "2339-0",
          valueQuantity: { value: 110 },
        },
      ],
    });
    expect(() => convertToInternalSchema(structure)).toThrow(
      "Missing required field: HbA1c Level"
    );
  });

  it("throws for missing blood glucose observation", () => {
    const structure = makeMinimalStructure({
      observations: [
        {
          codeDisplay: "BMI",
          code: "39156-5",
          valueQuantity: { value: 28.5 },
        },
        {
          codeDisplay: "HbA1c",
          code: "4548-4",
          valueQuantity: { value: 6.2 },
        },
      ],
    });
    expect(() => convertToInternalSchema(structure)).toThrow(
      "Missing required field: Blood Glucose Level"
    );
  });

  it("sets hypertension flag from BP component observation", () => {
    const structure = makeMinimalStructure({
      observations: [
        {
          codeDisplay: "blood pressure",
          code: "85354-9",
          component: [
            {
              code: { coding: [{ code: "8480-6" }] },
              valueQuantity: { value: 155 },
            },
            {
              code: { coding: [{ code: "8462-4" }] },
              valueQuantity: { value: 95 },
            },
          ],
        },
        {
          codeDisplay: "BMI",
          code: "39156-5",
          valueQuantity: { value: 28.5 },
        },
        {
          codeDisplay: "HbA1c",
          code: "4548-4",
          valueQuantity: { value: 6.2 },
        },
        {
          codeDisplay: "Blood Glucose",
          code: "2339-0",
          valueQuantity: { value: 110 },
        },
      ],
    });

    const result = convertToInternalSchema(structure);
    expect(result.hypertension).toBe(true);
  });

  it("sets smoking history from observation", () => {
    const structure = makeMinimalStructure({
      observations: [
        {
          codeDisplay: "Smoking status",
          valueString: "current smoker",
        },
        {
          codeDisplay: "BMI",
          code: "39156-5",
          valueQuantity: { value: 28.5 },
        },
        {
          codeDisplay: "HbA1c",
          code: "4548-4",
          valueQuantity: { value: 6.2 },
        },
        {
          codeDisplay: "Blood Glucose",
          code: "2339-0",
          valueQuantity: { value: 110 },
        },
      ],
    });

    const result = convertToInternalSchema(structure);
    expect(result.smokingHistory).toBe("current");
  });
});
