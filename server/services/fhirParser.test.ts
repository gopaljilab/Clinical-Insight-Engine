import { describe, expect, it } from "vitest";
import {
  validateFhirBundle,
  parseFhirBundle,
  convertToInternalSchema,
  extractExplainableInsights,
  type NormalizedFhirStructure,
} from "./fhirParser";

describe("validateFhirBundle", () => {
  it("passes for valid FHIR R4 Bundle", () => {
    expect(() =>
      validateFhirBundle({
        resourceType: "Bundle",
        type: "collection",
        entry: [{ resource: { resourceType: "Patient", id: "p1" } }],
      })
    ).not.toThrow();
  });

  it("throws for null payload", () => {
    expect(() => validateFhirBundle(null)).toThrow("Invalid FHIR payload");
  });

  it("throws for non-object payload", () => {
    expect(() => validateFhirBundle("string" as any)).toThrow("Invalid FHIR payload");
  });

  it("throws when resourceType is missing", () => {
    expect(() => validateFhirBundle({ type: "collection", entry: [] } as any)).toThrow(
      "Invalid FHIR payload"
    );
  });

  it("throws for non-Bundle resourceType", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Patient", type: "collection", entry: [] } as any)
    ).toThrow("Unsupported FHIR structure");
  });

  it("throws when type is missing", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", entry: [] } as any)
    ).toThrow("Unsupported FHIR structure");
  });

  it("throws when entry is missing", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection" } as any)
    ).toThrow("Missing Bundle entries");
  });

  it("throws when entry is not an array", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: {} } as any)
    ).toThrow("Missing Bundle entries");
  });

  it("throws when entry is empty", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: [] })
    ).toThrow("Missing Bundle entries");
  });
});

describe("parseFhirBundle", () => {
  it("parses Patient resource with official name", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ use: "official", given: ["John"], family: "Doe" }],
            gender: "male",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient?.name).toBe("John Doe");
    expect(result.patient?.gender).toBe("Male");
  });

  it("parses Patient resource with usual name fallback", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ use: "usual", given: ["Jane"], family: "Smith" }],
            gender: "female",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient?.name).toBe("Jane Smith");
    expect(result.patient?.gender).toBe("Female");
  });

  it("parses Patient resource with first name when no official/usual", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            name: [{ given: ["Bob"], family: "Jones" }],
            gender: "male",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient?.name).toBe("Bob Jones");
  });

  it("skips unrecognized resourceTypes", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [{ resource: { resourceType: "Organization", id: "org1" } }],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient).toBeUndefined();
    expect(result.observations).toHaveLength(0);
  });

  it("skips malformed entries gracefully", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [null, { resource: { resourceType: "Patient", name: [], gender: "male" } }],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient?.name).toBe("");
  });

  it("parses Observation with valueQuantity", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "12345", display: "BMI" }] },
            valueQuantity: { value: 28.5, unit: "kg/m2" },
            effectiveDateTime: "2024-01-01",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0].code).toBe("12345");
    expect(result.observations[0].codeDisplay).toBe("BMI");
    expect(result.observations[0].valueQuantity?.value).toBe(28.5);
  });

  it("parses Observation with valueString", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { text: "Hypertension status" },
            valueString: "yes",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations[0].valueString).toBe("yes");
  });

  it("parses Observation with components", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { text: "Blood pressure panel" },
            component: [
              { code: { coding: [{ code: "8480-6", display: "Systolic" }] }, valueQuantity: { value: 150 } },
              { code: { coding: [{ code: "8462-4", display: "Diastolic" }] }, valueQuantity: { value: 95 } },
            ],
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations[0].component).toHaveLength(2);
    expect(result.observations[0].component?.[0].valueQuantity?.value).toBe(150);
  });

  it("parses DocumentReference with attachment data (base64)", () => {
    const bundle: any = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "DocumentReference",
            description: "Clinical note",
            type: { text: "Progress Note" },
            content: [{ attachment: { title: "note.txt", data: "SGVsbG8gV29ybGQ=" } }],
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].attachmentContent).toBe("Hello World");
    expect(result.documents[0].description).toBe("Clinical note");
  });
});

describe("convertToInternalSchema", () => {
  // Helper that provides required observations using LOINC codes
  // so the code's (code === "39156-5") check fires correctly.
  function withRequiredObs(extraObs: any[] = []): NormalizedFhirStructure {
    return {
      patient: { name: "Test Patient", gender: "Male", birthDate: "1980-01-01" },
      observations: [
        { code: "39156-5", codeDisplay: "body mass index", valueQuantity: { value: 28.5 } },
        { code: "4548-4", codeDisplay: "glycated hemoglobin", valueQuantity: { value: 6.5 } },
        { code: "2339-0", codeDisplay: "blood glucose", valueQuantity: { value: 120 } },
        ...extraObs,
      ],
      documents: [],
    };
  }

  it("throws when patient is missing", () => {
    expect(() => convertToInternalSchema({ observations: [], documents: [] })).toThrow(
      "Missing required field: Patient Name"
    );
  });

  it("throws when patient name is missing", () => {
    expect(() =>
      convertToInternalSchema({ patient: { name: "", gender: "Male" }, observations: [], documents: [] } as any)
    ).toThrow("Missing required field: Patient Name");
  });

  it("throws when gender is missing", () => {
    expect(() =>
      convertToInternalSchema({ patient: { name: "Test" }, observations: [], documents: [] } as any)
    ).toThrow("Missing required field: Gender");
  });

  it("throws when gender is invalid", () => {
    expect(() =>
      convertToInternalSchema({ patient: { name: "Test", gender: "Other" as any }, observations: [], documents: [] })
    ).toThrow("Gender must be 'Male' or 'Female'");
  });

  it("throws when birthDate is missing", () => {
    expect(() =>
      convertToInternalSchema({ patient: { name: "Test", gender: "Male" }, observations: [], documents: [] } as any)
    ).toThrow("Missing required field: Age");
  });

  it("throws when birthDate is invalid", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "Test", gender: "Male", birthDate: "not-a-date" },
        observations: [],
        documents: [],
      } as any)
    ).toThrow("Invalid birth date format");
  });

  it("throws when age is out of range", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "Test", gender: "Male", birthDate: "1800-01-01" },
        observations: [],
        documents: [],
      })
    ).toThrow("Age must be between 1 and 120");
  });

  it("throws when BMI observation is missing", () => {
    expect(() =>
      convertToInternalSchema({
        patient: { name: "Test Patient", gender: "Male", birthDate: "1980-01-01" },
        observations: [
          { code: "4548-4", valueQuantity: { value: 6.5 } },
          { code: "2339-0", valueQuantity: { value: 120 } },
        ],
        documents: [],
      })
    ).toThrow("Missing required field: BMI");
  });

  it("maps BMI from LOINC code", () => {
    const result = convertToInternalSchema(withRequiredObs());
    expect(result.bmi).toBe(28.5);
  });

  it("maps HbA1c from LOINC code", () => {
    const result = convertToInternalSchema(withRequiredObs());
    expect(result.hba1cLevel).toBe(6.5);
  });

  it("maps Blood Glucose from LOINC code", () => {
    const result = convertToInternalSchema(withRequiredObs());
    expect(result.bloodGlucoseLevel).toBe(120);
  });

  it("detects hypertension from BP component systolic > 140", () => {
    const result = convertToInternalSchema({
      patient: { name: "Test Patient", gender: "Male", birthDate: "1980-01-01" },
      observations: [
        { code: "39156-5", valueQuantity: { value: 28.5 } },
        { code: "4548-4", valueQuantity: { value: 6.5 } },
        { code: "2339-0", valueQuantity: { value: 120 } },
        {
          code: "85354-9",
          codeDisplay: "Blood pressure panel",
          valueQuantity: { value: 1 },
          component: [{ code: { coding: [{ code: "8480-6" }] }, valueQuantity: { value: 150 } }],
        },
      ],
      documents: [],
    });
    expect(result.hypertension).toBe(true);
  });

  it("maps hypertension from display keyword", () => {
    const result = convertToInternalSchema(withRequiredObs([
      { code: "x", codeDisplay: "hypertension", valueString: "yes" },
    ]));
    expect(result.hypertension).toBe(true);
  });

  it("maps heart disease from display keyword", () => {
    const result = convertToInternalSchema(withRequiredObs([
      { code: "x", codeDisplay: "coronary artery disease status", valueString: "active" },
    ]));
    expect(result.heartDisease).toBe(true);
  });

  it("maps smoking history (current) from display", () => {
    const result = convertToInternalSchema(withRequiredObs([
      { code: "x", codeDisplay: "tobacco smoking status", valueString: "current smoker" },
    ]));
    expect(result.smokingHistory).toBe("current");
  });

  it("maps smoking history (former) from display", () => {
    const result = convertToInternalSchema(withRequiredObs([
      { code: "x", codeDisplay: "tobacco smoking status", valueString: "former smoker" },
    ]));
    expect(result.smokingHistory).toBe("former");
  });

  it("maps smoking history (never) from display", () => {
    const result = convertToInternalSchema(withRequiredObs([
      { code: "x", codeDisplay: "tobacco smoking status", valueString: "never smoked" },
    ]));
    expect(result.smokingHistory).toBe("never");
  });

  it("detects hypertension from DocumentReference content", () => {
    const result = convertToInternalSchema({
      patient: { name: "Test Patient", gender: "Male", birthDate: "1980-01-01" },
      observations: [
        { code: "39156-5", valueQuantity: { value: 28.5 } },
        { code: "4548-4", valueQuantity: { value: 6.5 } },
        { code: "2339-0", valueQuantity: { value: 120 } },
      ],
      documents: [
        { description: "Patient has hypertension.", type: "Clinical Note" },
      ],
    });
    expect(result.hypertension).toBe(true);
  });

  it("maps all clinical fields correctly", () => {
    const result = convertToInternalSchema(withRequiredObs());
    expect(result.patientName).toBe("Test Patient");
    expect(result.gender).toBe("Male");
    expect(result.age).toBeGreaterThan(0);
    expect(result.hypertension).toBe(false);
    expect(result.heartDisease).toBe(false);
    expect(result.smokingHistory).toBe("No Info");
  });

});

describe("extractExplainableInsights", () => {
  it("returns default insights for empty noteText", () => {
    const insights = extractExplainableInsights("");
    expect(insights).toHaveLength(3);
    expect(insights[0].source_snippet).toBeNull();
    expect(insights[1].source_snippet).toBeNull();
    expect(insights[2].source_snippet).toBeNull();
  });

  it("extracts BP sentence when systolic > 140", () => {
    const text = "Patient BP reading is 150/90 mmHg and requires review.";
    const insights = extractExplainableInsights(text);
    const htInsight = insights.find(i => i.insight.includes("hypertension"));
    expect(htInsight?.source_snippet).toContain("150/90");
  });

  it("extracts heart disease keyword sentence", () => {
    const text = "Patient has a history of myocardial infarction in 2019.";
    const insights = extractExplainableInsights(text);
    const hdInsight = insights.find(i => i.insight.includes("heart disease"));
    expect(hdInsight?.source_snippet).toContain("myocardial infarction");
    expect(hdInsight?.source_index).not.toBeNull();
  });

  it("extracts smoking history (current)", () => {
    const text = "Patient is a current smoker with 10 pack-year history.";
    const insights = extractExplainableInsights(text);
    const shInsight = insights.find(i => i.insight.includes("current"));
    expect(shInsight?.source_snippet).toContain("current smoker");
  });

  it("extracts smoking history (former)", () => {
    const text = "Patient is a former smoker, quit 5 years ago.";
    const insights = extractExplainableInsights(text);
    const shInsight = insights.find(i => i.insight.includes("former"));
    expect(shInsight?.source_snippet).toContain("former smoker");
  });

  it("extracts smoking history (never)", () => {
    const text = "Patient has never smoked cigarettes.";
    const insights = extractExplainableInsights(text);
    const shInsight = insights.find(i => i.insight.includes("never"));
    expect(shInsight?.source_snippet).toContain("never smoked");
  });

  it("returns snippet with correct character indices", () => {
    const text = "Patient has hypertension requiring treatment.";
    const insights = extractExplainableInsights(text);
    const htInsight = insights.find(i => i.insight.includes("hypertension"));
    expect(htInsight?.source_index).not.toBeNull();
    const [start, end] = htInsight!.source_index!;
    expect(text.substring(start, end)).toContain("hypertension");
  });

  it("does not extract when thresholds are not met", () => {
    const text = "Patient BP reading is 120/80 mmHg.";
    const insights = extractExplainableInsights(text);
    const htInsight = insights.find(i => i.insight.includes("hypertension"));
    // Systolic 120 is not > 140, so no snippet extraction
    expect(htInsight?.source_snippet).toBeNull();
  });
});
