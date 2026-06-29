import { describe, it, expect } from "vitest";
import {
  validateFhirBundle,
  parseFhirBundle,
  extractExplainableInsights,
  convertToInternalSchema,
} from "./fhirParser";

describe("validateFhirBundle", () => {
  it("accepts a valid Bundle with entries", () => {
    expect(() =>
      validateFhirBundle({
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: { resourceType: "Patient" } }],
      })
    ).not.toThrow();
  });

  it("throws for null/undefined payload", () => {
    expect(() => validateFhirBundle(null)).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle(undefined)).toThrow("Invalid FHIR payload");
  });

  it("throws for non-object payload", () => {
    expect(() => validateFhirBundle("Bundle")).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle(42)).toThrow("Invalid FHIR payload");
  });

  it("throws when resourceType is missing", () => {
    expect(() =>
      validateFhirBundle({ type: "collection", entry: [] })
    ).toThrow("Invalid FHIR payload");
  });

  it("throws when resourceType is not Bundle", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Patient", entry: [] })
    ).toThrow("Unsupported FHIR structure");
  });

  it("throws when type is missing or non-string", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", entry: [] })
    ).toThrow("Unsupported FHIR structure");
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: 123, entry: [] })
    ).toThrow("Unsupported FHIR structure");
  });

  it("throws when entry is missing", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection" })
    ).toThrow("Missing Bundle entries");
  });

  it("throws when entry is not an array", () => {
    expect(() =>
      validateFhirBundle({
        resourceType: "Bundle",
        type: "collection",
        entry: "not-an-array",
      })
    ).toThrow("Missing Bundle entries");
  });

  it("throws when entry array is empty", () => {
    expect(() =>
      validateFhirBundle({
        resourceType: "Bundle",
        type: "collection",
        entry: [],
      })
    ).toThrow("Missing Bundle entries");
  });
});

describe("parseFhirBundle", () => {
  const validBundle = (entries: object[]) => ({
    resourceType: "Bundle",
    type: "collection",
    entry: entries,
  });

  describe("Patient resource", () => {
    it("extracts official name", () => {
      const bundle = validBundle([
        {
          resource: {
            resourceType: "Patient",
            name: [{ use: "official", given: ["John"], family: "Doe" }],
          },
        },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.patient?.name).toBe("John Doe");
    });

    it("extracts usual name when official is absent", () => {
      const bundle = validBundle([
        {
          resource: {
            resourceType: "Patient",
            name: [{ use: "usual", given: ["Jane"], family: "Smith" }],
          },
        },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.patient?.name).toBe("Jane Smith");
    });

    it("uses first name when official and usual are absent", () => {
      const bundle = validBundle([
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["Bob"], family: "Jones" }],
          },
        },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.patient?.name).toBe("Bob Jones");
    });

    it("maps gender male to Male", () => {
      const bundle = validBundle([
        { resource: { resourceType: "Patient", gender: "male" } },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.patient?.gender).toBe("Male");
    });

    it("maps gender female to Female", () => {
      const bundle = validBundle([
        { resource: { resourceType: "Patient", gender: "female" } },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.patient?.gender).toBe("Female");
    });

    it("extracts birthDate", () => {
      const bundle = validBundle([
        { resource: { resourceType: "Patient", birthDate: "1985-03-15" } },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.patient?.birthDate).toBe("1985-03-15");
    });
  });

  describe("Observation resource", () => {
    it("extracts code display and code value", () => {
      const bundle = validBundle([
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "2339-0", display: "Glucose" }] },
          },
        },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.observations[0].codeDisplay).toBe("Glucose");
      expect(result.observations[0].code).toBe("2339-0");
    });

    it("extracts valueQuantity", () => {
      const bundle = validBundle([
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "2339-0" }] },
            valueQuantity: { value: 95, unit: "mg/dL" },
          },
        },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.observations[0].valueQuantity).toEqual({
        value: 95,
        unit: "mg/dL",
      });
    });

    it("extracts valueString", () => {
      const bundle = validBundle([
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ display: "Status" }] },
            valueString: "active",
          },
        },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.observations[0].valueString).toBe("active");
    });

    it("extracts effectiveDateTime", () => {
      const bundle = validBundle([
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ display: "BP" }] },
            effectiveDateTime: "2024-01-15T10:00:00Z",
          },
        },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.observations[0].effectiveDateTime).toBe(
        "2024-01-15T10:00:00Z"
      );
    });

    it("extracts component array", () => {
      const bundle = validBundle([
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ display: "BP" }] },
            component: [
              {
                code: { coding: [{ code: "8480-6", display: "Systolic" }] },
                valueQuantity: { value: 120 },
              },
            ],
          },
        },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.observations[0].component).toHaveLength(1);
      expect(result.observations[0].component[0].valueQuantity?.value).toBe(120);
    });

    it("skips unsupported resourceTypes gracefully", () => {
      const bundle = validBundle([
        { resource: { resourceType: "Coverage" } },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.observations).toHaveLength(0);
    });

    it("skips entries without resource", () => {
      const bundle = validBundle([{ fullUrl: "http://example.com" }]);
      const result = parseFhirBundle(bundle);
      expect(result.observations).toHaveLength(0);
    });
  });

  describe("DocumentReference resource", () => {
    it("extracts description and type", () => {
      const bundle = validBundle([
        {
          resource: {
            resourceType: "DocumentReference",
            description: "Clinical note",
            type: { text: "Progress Note" },
          },
        },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.documents[0].description).toBe("Clinical note");
      expect(result.documents[0].type).toBe("Progress Note");
    });

    it("extracts attachment title", () => {
      const bundle = validBundle([
        {
          resource: {
            resourceType: "DocumentReference",
            content: [{ attachment: { title: "Note.pdf" } }],
          },
        },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.documents[0].attachmentTitle).toBe("Note.pdf");
    });

    it("decodes base64 attachment data to UTF-8 string", () => {
      const bundle = validBundle([
        {
          resource: {
            resourceType: "DocumentReference",
            content: [
              {
                attachment: {
                  data: Buffer.from("Patient presents with headache").toString("base64"),
                },
              },
            ],
          },
        },
      ]);
      const result = parseFhirBundle(bundle);
      expect(result.documents[0].attachmentContent).toBe(
        "Patient presents with headache"
      );
    });
  });
});

describe("extractExplainableInsights", () => {
  it("returns 3 default insights for empty text", () => {
    const result = extractExplainableInsights("");
    expect(result).toHaveLength(3);
    expect(result[0].source_snippet).toBeNull();
    expect(result[1].source_snippet).toBeNull();
    expect(result[2].source_snippet).toBeNull();
  });

  describe("hypertension", () => {
    it("extracts BP reading above threshold (>140/>90)", () => {
      const result = extractExplainableInsights(
        "Patient BP reading 150/95 mmHg today."
      );
      const ht = result.find(
        (i) => i.insight === "Patient shows signs of hypertension"
      );
      expect(ht?.source_snippet).toContain("150/95");
    });

    it("extracts BP reading with pipe separator", () => {
      const result = extractExplainableInsights("BP 160|100 is elevated.");
      const ht = result.find(
        (i) => i.insight === "Patient shows signs of hypertension"
      );
      expect(ht?.source_snippet).not.toBeNull();
    });

    it("detects hypertension keyword", () => {
      const result = extractExplainableInsights(
        "Patient has a history of hypertension."
      );
      const ht = result.find(
        (i) => i.insight === "Patient shows signs of hypertension"
      );
      expect(ht?.source_snippet).toContain("hypertension");
    });

    it("detects high blood pressure keyword", () => {
      const result = extractExplainableInsights(
        "Clinical note: patient with high blood pressure."
      );
      const ht = result.find(
        (i) => i.insight === "Patient shows signs of hypertension"
      );
      expect(ht?.source_snippet).not.toBeNull();
    });

    it("detects HTN abbreviation", () => {
      const result = extractExplainableInsights(
        "Assessment: HTN confirmed, starting treatment."
      );
      const ht = result.find(
        (i) => i.insight === "Patient shows signs of hypertension"
      );
      expect(ht?.source_snippet).not.toBeNull();
    });
  });

  describe("heart disease", () => {
    it("detects coronary artery disease", () => {
      const result = extractExplainableInsights(
        "Patient diagnosed with coronary artery disease."
      );
      const hd = result.find(
        (i) => i.insight === "Patient shows signs of heart disease"
      );
      expect(hd?.source_snippet).not.toBeNull();
    });

    it("detects CAD abbreviation", () => {
      const result = extractExplainableInsights(
        "History: CAD, on statin therapy."
      );
      const hd = result.find(
        (i) => i.insight === "Patient shows signs of heart disease"
      );
      expect(hd?.source_snippet).not.toBeNull();
    });

    it("detects myocardial infarction", () => {
      const result = extractExplainableInsights(
        "Patient had a myocardial infarction in 2020."
      );
      const hd = result.find(
        (i) => i.insight === "Patient shows signs of heart disease"
      );
      expect(hd?.source_snippet).not.toBeNull();
    });

    it("detects MI abbreviation", () => {
      const result = extractExplainableInsights(
        "PMH: MI in 2019, currently stable."
      );
      const hd = result.find(
        (i) => i.insight === "Patient shows signs of heart disease"
      );
      expect(hd?.source_snippet).not.toBeNull();
    });

    it("detects heart failure", () => {
      const result = extractExplainableInsights(
        "Echocardiogram shows heart failure with reduced EF."
      );
      const hd = result.find(
        (i) => i.insight === "Patient shows signs of heart disease"
      );
      expect(hd?.source_snippet).not.toBeNull();
    });

    it("detects atrial fibrillation", () => {
      const result = extractExplainableInsights(
        "ECG shows atrial fibrillation with RVR."
      );
      const hd = result.find(
        (i) => i.insight === "Patient shows signs of heart disease"
      );
      expect(hd?.source_snippet).not.toBeNull();
    });
  });

  describe("smoking history", () => {
    it("detects current smoker", () => {
      const result = extractExplainableInsights(
        "Patient is a current smoker, 1 pack per day."
      );
      const sh = result.find((i) =>
        i.insight.includes("Patient has a smoking history (current)")
      );
      expect(sh?.source_snippet).not.toBeNull();
    });

    it("detects active smoker", () => {
      const result = extractExplainableInsights(
        "Tobacco use: active smoker."
      );
      const sh = result.find((i) =>
        i.insight.includes("Patient has a smoking history (current)")
      );
      expect(sh?.source_snippet).not.toBeNull();
    });

    it("detects former smoker", () => {
      const result = extractExplainableInsights(
        "Former smoker, quit 5 years ago."
      );
      const sh = result.find((i) =>
        i.insight.includes("Patient has a smoking history (former)")
      );
      expect(sh?.source_snippet).not.toBeNull();
    });

    it("detects non-smoker", () => {
      const result = extractExplainableInsights(
        "Patient is a non-smoker with no tobacco use."
      );
      const sh = result.find((i) =>
        i.insight.includes("Patient has a smoking history (never)")
      );
      expect(sh?.source_snippet).not.toBeNull();
    });

    it("detects never smoked", () => {
      const result = extractExplainableInsights(
        "Patient reports they have never smoked."
      );
      const sh = result.find((i) =>
        i.insight.includes("Patient has a smoking history (never)")
      );
      expect(sh?.source_snippet).not.toBeNull();
    });
  });

  it("returns source_index as [start, end] tuple for matched keywords", () => {
    const result = extractExplainableInsights(
      "Hypertension noted in history."
    );
    const ht = result.find(
      (i) => i.insight === "Patient shows signs of hypertension"
    );
    expect(ht?.source_index).not.toBeNull();
    expect(Array.isArray(ht?.source_index)).toBe(true);
    expect(ht?.source_index).toHaveLength(2);
  });
});

describe("convertToInternalSchema", () => {
  const minimalBundle = (patientName: string, gender: string, birthDate: string) => ({
    patient: { name: patientName, gender, birthDate },
    observations: [
      {
        codeDisplay: "BMI",
        valueQuantity: { value: 25.5 },
      },
      {
        codeDisplay: "HbA1c",
        valueQuantity: { value: 6.2 },
      },
      {
        codeDisplay: "Glucose",
        valueQuantity: { value: 100 },
      },
    ],
    documents: [],
  });

  it("throws when patient is missing", () => {
    expect(() =>
      convertToInternalSchema({ patient: undefined as any, observations: [], documents: [] })
    ).toThrow("Missing required field: Patient Name");
  });

  it("throws when patient name is missing", () => {
    expect(() =>
      convertToInternalSchema(
        minimalBundle("", "Male", "1980-01-01")
      )
    ).toThrow("Missing required field: Patient Name");
  });

  it("throws when gender is missing", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "John", gender: undefined as any, birthDate: "1980-01-01" },
        observations: [],
        documents: [],
      })
    ).toThrow("Missing required field: Gender");
  });

  it("throws when gender is not Male or Female", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "John", gender: "other" as any, birthDate: "1980-01-01" },
        observations: [],
        documents: [],
      })
    ).toThrow("Gender must be 'Male' or 'Female'");
  });

  it("throws when birthDate is missing", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "John", gender: "Male" },
        observations: [],
        documents: [],
      })
    ).toThrow("Missing required field: Age");
  });

  it("throws for invalid birthDate format", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "John", gender: "Male", birthDate: "not-a-date" },
        observations: [],
        documents: [],
      })
    ).toThrow("Invalid birth date format");
  });

  it("throws for age out of range (future birth date)", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "John", gender: "Male", birthDate: "2099-01-01" },
        observations: [
          { codeDisplay: "BMI", valueQuantity: { value: 25 } },
          { codeDisplay: "HbA1c", valueQuantity: { value: 6.2 } },
          { codeDisplay: "Glucose", valueQuantity: { value: 100 } },
        ],
        documents: [],
      })
    ).toThrow("Age must be between 1 and 120");
  });

  it("throws when BMI observation is missing", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "John", gender: "Male", birthDate: "1980-01-01" },
        observations: [
          {
            codeDisplay: "HbA1c",
            valueQuantity: { value: 6.2 },
          },
        ],
        documents: [],
      })
    ).toThrow("Missing required field: BMI");
  });

  it("throws when HbA1c observation is missing", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "John", gender: "Male", birthDate: "1980-01-01" },
        observations: [
          { codeDisplay: "BMI", valueQuantity: { value: 25 } },
        ],
        documents: [],
      })
    ).toThrow("Missing required field: HbA1c Level");
  });

  it("throws when blood glucose observation is missing", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "John", gender: "Male", birthDate: "1980-01-01" },
        observations: [
          { codeDisplay: "BMI", valueQuantity: { value: 25 } },
          { codeDisplay: "HbA1c", valueQuantity: { value: 6.2 } },
        ],
        documents: [],
      })
    ).toThrow("Missing required field: Blood Glucose Level");
  });

  it("returns InsertAssessment for valid minimal input", () => {
    const result = convertToInternalSchema(
      minimalBundle("John Doe", "Male", "1985-06-15")
    );
    expect(result.patientName).toBe("John Doe");
    expect(result.gender).toBe("Male");
    expect(result.bmi).toBe(25.5);
    expect(result.hba1cLevel).toBe(6.2);
    expect(result.bloodGlucoseLevel).toBe(100);
  });

  it("infers hypertension from observation valueString", () => {
    const result = convertToInternalSchema({
      patient: { name: "John", gender: "Male", birthDate: "1980-01-01" },
      observations: [
        { codeDisplay: "BMI", valueQuantity: { value: 25 } },
        { codeDisplay: "HbA1c", valueQuantity: { value: 6.2 } },
        { codeDisplay: "Glucose", valueQuantity: { value: 100 } },
        { codeDisplay: "Hypertension", valueString: "yes" },
      ],
      documents: [],
    });
    expect(result.hypertension).toBe(true);
  });

  it("maps smoking history from observation valueString", () => {
    const result = convertToInternalSchema({
      patient: { name: "John", gender: "Male", birthDate: "1980-01-01" },
      observations: [
        { codeDisplay: "BMI", valueQuantity: { value: 25 } },
        { codeDisplay: "HbA1c", valueQuantity: { value: 6.2 } },
        { codeDisplay: "Glucose", valueQuantity: { value: 100 } },
        { codeDisplay: "Smoking", valueString: "former smoker" },
      ],
      documents: [],
    });
    expect(result.smokingHistory).toBe("former");
  });
});
