import { describe, test, expect } from "vitest";
import {
  validateFhirBundle,
  parseFhirBundle,
  convertToInternalSchema,
  extractExplainableInsights,
} from "./fhirParser";

describe("fhirParser — validateFhirBundle", () => {
  test("accepts a valid FHIR R4 Bundle", () => {
    expect(() =>
      validateFhirBundle({
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: {} }],
      })
    ).not.toThrow();
  });

  test("throws for non-object payload", () => {
    expect(() => validateFhirBundle(null)).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle(undefined)).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle("string")).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle(42)).toThrow("Invalid FHIR payload");
  });

  test("throws when resourceType is missing", () => {
    expect(() => validateFhirBundle({ type: "collection", entry: [] })).toThrow(
      "Invalid FHIR payload"
    );
  });

  test("throws for unsupported resourceType", () => {
    expect(() =>
      validateFhirBundle({
        resourceType: "Patient",
        type: "collection",
        entry: [],
      })
    ).toThrow("Unsupported FHIR structure");
  });

  test("throws when type is missing", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", entry: [{ resource: {} }] })
    ).toThrow("Unsupported FHIR structure");
  });

  test("throws when entry is missing or not an array", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection" })
    ).toThrow("Missing Bundle entries");
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: "not-array" })
    ).toThrow("Missing Bundle entries");
  });

  test("throws when entry is empty", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: [] })
    ).toThrow("Missing Bundle entries");
  });
});

describe("fhirParser — parseFhirBundle", () => {
  test("parses a Patient resource", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "p-001",
            name: [{ use: "official", given: ["John"], family: "Doe" }],
            gender: "male",
            birthDate: "1980-05-15",
          },
        },
      ],
    };

    const result = parseFhirBundle(bundle);
    expect(result.patient).toBeDefined();
    expect(result.patient.name).toBe("John Doe");
    expect(result.patient.gender).toBe("Male");
    expect(result.patient.birthDate).toBe("1980-05-15");
    expect(result.patient.id).toBe("p-001");
  });

  test("normalizes gender values to Male/Female", () => {
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
    expect(result.patient.gender).toBe("Female");
  });

  test("falls back to first name when official/usual not present", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ use: "nickname", given: ["Johnny"], family: "Doe" }],
            gender: "male",
          },
        },
      ],
    };

    const result = parseFhirBundle(bundle);
    expect(result.patient.name).toBe("Johnny Doe");
  });

  test("parses Observation with valueQuantity", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "4548-4", display: "HbA1c" }] },
            effectiveDateTime: "2024-01-15",
            valueQuantity: { value: 6.5, unit: "%" },
          },
        },
      ],
    };

    const result = parseFhirBundle(bundle);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].code).toBe("4548-4");
    expect(result.observations[0].codeDisplay).toBe("HbA1c");
    expect(result.observations[0].valueQuantity.value).toBe(6.5);
  });

  test("parses Observation with valueString", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { text: "Status" },
            valueString: "active",
          },
        },
      ],
    };

    const result = parseFhirBundle(bundle);
    expect(result.observations[0].valueString).toBe("active");
  });

  test("parses Observation components", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "85354-9" }] },
            component: [
              {
                code: { coding: [{ code: "8480-6" }] },
                valueQuantity: { value: 145 },
              },
            ],
          },
        },
      ],
    };

    const result = parseFhirBundle(bundle);
    expect(result.observations[0].component).toHaveLength(1);
    expect(result.observations[0].component[0].valueQuantity.value).toBe(145);
  });

  test("parses DocumentReference with attachment", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "DocumentReference",
            description: "Clinical notes",
            type: { text: "Progress Note" },
            content: [
              {
                attachment: {
                  title: "Note Title",
                  data: Buffer.from("Patient notes here").toString("base64"),
                },
              },
            ],
          },
        },
      ],
    };

    const result = parseFhirBundle(bundle);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].description).toBe("Clinical notes");
    expect(result.documents[0].type).toBe("Progress Note");
    expect(result.documents[0].attachmentTitle).toBe("Note Title");
    expect(result.documents[0].attachmentContent).toBe("Patient notes here");
  });

  test("skips entries without resource", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [{}, { resource: null }, { resource: { resourceType: "Patient" } }],
    };

    const result = parseFhirBundle(bundle);
    expect(result.observations).toHaveLength(0);
    expect(result.documents).toHaveLength(0);
  });
});

describe("fhirParser — extractExplainableInsights", () => {
  test("returns empty default insights for empty note", () => {
    const insights = extractExplainableInsights("");
    expect(insights).toHaveLength(3);
    expect(insights[0].insight).toBe("Patient shows signs of hypertension");
    expect(insights[0].source_snippet).toBeNull();
  });

  test("extracts hypertension from BP reading > 140/90", () => {
    const insights = extractExplainableInsights("Patient BP reading is 150/95 mmHg today.");
    const ht = insights.find((i) => i.insight.includes("hypertension"));
    expect(ht).toBeDefined();
    expect(ht.source_snippet).toContain("150/95");
  });

  test("extracts hypertension from explicit keyword", () => {
    const insights = extractExplainableInsights("Patient has a history of hypertension.");
    const ht = insights.find((i) => i.insight.includes("hypertension"));
    expect(ht).toBeDefined();
    expect(ht.source_snippet).toBeTruthy();
  });

  test("extracts heart disease from CAD keyword", () => {
    const insights = extractExplainableInsights(
      "Coronary artery disease was diagnosed in 2020."
    );
    const hd = insights.find((i) => i.insight.includes("heart disease"));
    expect(hd).toBeDefined();
    expect(hd.source_snippet).toBeTruthy();
  });

  test("extracts smoking history — current smoker", () => {
    const insights = extractExplainableInsights(
      "Patient is a current smoker, 10 cigarettes per day."
    );
    const sh = insights.find((i) => i.insight.includes("smoking history"));
    expect(sh).toBeDefined();
    expect(sh.insight).toContain("current");
  });

  test("extracts smoking history — former smoker", () => {
    const insights = extractExplainableInsights(
      "Former smoker, quit in 2015."
    );
    const sh = insights.find((i) => i.insight.includes("smoking history"));
    expect(sh).toBeDefined();
    expect(sh.insight).toContain("former");
  });

  test("extracts smoking history — never", () => {
    const insights = extractExplainableInsights(
      "Non-smoker, no tobacco use ever."
    );
    const sh = insights.find((i) => i.insight.includes("smoking history"));
    expect(sh).toBeDefined();
    expect(sh.insight).toContain("never");
  });
});

describe("fhirParser — convertToInternalSchema", () => {
  test("converts a valid FHIR bundle to InsertAssessment schema", () => {
    const structure = {
      patient: {
        id: "p-001",
        name: "Jane Doe",
        gender: "Female" as const,
        birthDate: "1985-03-20",
      },
      observations: [
        {
          codeDisplay: "Body Mass Index",
          code: "39156-5",
          valueQuantity: { value: 27.5 },
        },
        {
          codeDisplay: "HbA1c",
          code: "4548-4",
          valueQuantity: { value: 6.1 },
        },
        {
          codeDisplay: "Blood glucose",
          code: "2339-0",
          valueQuantity: { value: 110 },
        },
      ],
      documents: [],
    };

    const result = convertToInternalSchema(structure);
    expect(result.patientName).toBe("Jane Doe");
    expect(result.gender).toBe("Female");
    expect(result.age).toBe(41);
    expect(result.bmi).toBe(27.5);
    expect(result.hba1cLevel).toBe(6.1);
    expect(result.bloodGlucoseLevel).toBe(110);
  });

  test("throws when patient is missing", () => {
    expect(() =>
      convertToInternalSchema({ patient: undefined as any, observations: [], documents: [] })
    ).toThrow("Missing required field: Patient Name");
  });

  test("throws when patient name is missing", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "", gender: "Male" as const, birthDate: "1980-01-01" },
        observations: [],
        documents: [],
      })
    ).toThrow("Missing required field: Patient Name");
  });

  test("throws for invalid gender", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "John", gender: "Unknown" as any, birthDate: "1980-01-01" },
        observations: [],
        documents: [],
      })
    ).toThrow("Gender must be 'Male' or 'Female'");
  });

  test("throws when birthDate is missing", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "John", gender: "Male" as const },
        observations: [],
        documents: [],
      })
    ).toThrow("Missing required field: Age");
  });

  test("throws for age outside 1-120 range", () => {
    const tooOld = {
      patient: { name: "John", gender: "Male" as const, birthDate: "1800-01-01" },
      observations: [],
      documents: [],
    };
    expect(() => convertToInternalSchema(tooOld)).toThrow("Age must be between 1 and 120");
  });

  test("throws when BMI is missing", () => {
    const structure = {
      patient: { name: "John", gender: "Male" as const, birthDate: "1980-01-01" },
      observations: [
        { codeDisplay: "HbA1c", code: "4548-4", valueQuantity: { value: 6.0 } },
        { codeDisplay: "glucose", code: "2339-0", valueQuantity: { value: 100 } },
      ],
      documents: [],
    };
    expect(() => convertToInternalSchema(structure)).toThrow(
      "Missing required field: BMI"
    );
  });

  test("throws when HbA1c is missing", () => {
    const structure = {
      patient: { name: "John", gender: "Male" as const, birthDate: "1980-01-01" },
      observations: [
        { codeDisplay: "bmi", code: "39156-5", valueQuantity: { value: 25.0 } },
        { codeDisplay: "glucose", code: "2339-0", valueQuantity: { value: 100 } },
      ],
      documents: [],
    };
    expect(() => convertToInternalSchema(structure)).toThrow(
      "Missing required field: HbA1c Level"
    );
  });

  test("sets hypertension from blood pressure observation", () => {
    const structure = {
      patient: { name: "John", gender: "Male" as const, birthDate: "1980-01-01" },
      observations: [
        { codeDisplay: "bmi", code: "39156-5", valueQuantity: { value: 25.0 } },
        { codeDisplay: "HbA1c", code: "4548-4", valueQuantity: { value: 6.0 } },
        { codeDisplay: "glucose", code: "2339-0", valueQuantity: { value: 100 } },
        {
          codeDisplay: "blood pressure",
          code: "85354-9",
          component: [
            { code: { coding: [{ code: "8480-6" }] }, valueQuantity: { value: 160 } },
          ],
        },
      ],
      documents: [],
    };
    const result = convertToInternalSchema(structure);
    expect(result.hypertension).toBe(true);
  });

  test("extracts smoking history from observation", () => {
    const structure = {
      patient: { name: "John", gender: "Male" as const, birthDate: "1980-01-01" },
      observations: [
        { codeDisplay: "bmi", code: "39156-5", valueQuantity: { value: 25.0 } },
        { codeDisplay: "HbA1c", code: "4548-4", valueQuantity: { value: 6.0 } },
        { codeDisplay: "glucose", code: "2339-0", valueQuantity: { value: 100 } },
        { codeDisplay: "smoking status", valueString: "current smoker" },
      ],
      documents: [],
    };
    const result = convertToInternalSchema(structure);
    expect(result.smokingHistory).toBe("current");
  });

  test("extracts clinical note from DocumentReference", () => {
    const structure = {
      patient: { name: "John", gender: "Male" as const, birthDate: "1980-01-01" },
      observations: [
        { codeDisplay: "bmi", code: "39156-5", valueQuantity: { value: 25.0 } },
        { codeDisplay: "HbA1c", code: "4548-4", valueQuantity: { value: 6.0 } },
        { codeDisplay: "glucose", code: "2339-0", valueQuantity: { value: 100 } },
      ],
      documents: [
        {
          description: "Clinical note",
          attachmentContent: "Patient is recovering well.",
        },
      ],
    };
    const result = convertToInternalSchema(structure);
    expect(result.clinicalNote).toContain("recovering");
  });
});
