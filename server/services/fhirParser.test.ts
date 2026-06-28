import { describe, it, expect } from "vitest";
import {
  validateFhirBundle,
  parseFhirBundle,
  type NormalizedFhirStructure,
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

  it("throws for non-object payload", () => {
    expect(() => validateFhirBundle(null)).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle(undefined)).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle("string")).toThrow("Invalid FHIR payload");
    expect(() => validateFhirBundle(42)).toThrow("Invalid FHIR payload");
  });

  it("throws when resourceType is missing", () => {
    expect(() => validateFhirBundle({ type: "collection", entry: [] })).toThrow(
      "Invalid FHIR payload"
    );
  });

  it("throws for unsupported resourceType", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Patient", type: "collection", entry: [] })
    ).toThrow("Unsupported FHIR structure");
  });

  it("throws when type is missing", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", entry: [{ resource: {} }] })
    ).toThrow("Unsupported FHIR structure");
  });

  it("throws when entry is missing", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection" })
    ).toThrow("Missing Bundle entries");
  });

  it("throws when entry is not an array", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: "not-array" })
    ).toThrow("Missing Bundle entries");
  });

  it("throws when entry is an empty array", () => {
    expect(() =>
      validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: [] })
    ).toThrow("Missing Bundle entries");
  });
});

describe("parseFhirBundle", () => {
  it("returns empty observations and documents for bundle with no matching resources", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [{ resource: { resourceType: "Questionnaire" } }],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations).toEqual([]);
    expect(result.documents).toEqual([]);
    expect(result.patient).toBeUndefined();
  });

  it("skips entries without a resource", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        { noResource: true },
        null,
        undefined,
        { resource: { resourceType: "Questionnaire" } },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient).toBeUndefined();
    expect(result.observations).toEqual([]);
    expect(result.documents).toEqual([]);
  });

  it("parses a Patient resource with official name", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            id: "p123",
            gender: "male",
            birthDate: "1990-05-15",
            name: [{ use: "official", given: ["John"], family: "Doe" }],
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient).toEqual({
      id: "p123",
      name: "John Doe",
      gender: "Male",
      birthDate: "1990-05-15",
    });
  });

  it("parses a Patient resource with usual name fallback", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            gender: "female",
            name: [{ use: "nickname", given: ["Jill"], family: "Smith" }],
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient).toEqual({
      name: "Jill Smith",
      gender: "Female",
    });
  });

  it("handles missing name array in Patient", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            gender: "male",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient?.name).toBe("");
  });

  it("skips unknown gender values in Patient", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            gender: "unknown",
            name: [{ given: ["X"], family: "Y" }],
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient?.gender).toBeUndefined();
  });

  it("parses an Observation with valueQuantity", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "4548-4", display: "HbA1c" }] },
            valueQuantity: { value: 7.5, unit: "%" },
            effectiveDateTime: "2024-01-10",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations).toHaveLength(1);
    expect(result.observations[0]).toEqual({
      codeDisplay: "HbA1c",
      code: "4548-4",
      valueQuantity: { value: 7.5, unit: "%" },
      effectiveDateTime: "2024-01-10",
    });
  });

  it("parses an Observation with valueString", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            code: { text: "Smoking status" },
            valueString: "current smoker",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations[0].valueString).toBe("current smoker");
    expect(result.observations[0].codeDisplay).toBe("Smoking status");
  });

  it("parses an Observation with components", () => {
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
                code: { coding: [{ code: "8480-6", display: "Systolic" }] },
                valueQuantity: { value: 145 },
              },
              {
                code: { coding: [{ code: "8462-4", display: "Diastolic" }] },
                valueQuantity: { value: 95 },
              },
            ],
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations[0].component).toHaveLength(2);
    expect(result.observations[0].component[0].valueQuantity.value).toBe(145);
    expect(result.observations[0].component[1].valueQuantity.value).toBe(95);
  });

  it("parses a DocumentReference with description and type", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "DocumentReference",
            description: "Annual checkup",
            type: { text: "Progress Note" },
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toEqual({
      description: "Annual checkup",
      type: "Progress Note",
    });
  });

  it("parses DocumentReference with base64 attachment content", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "DocumentReference",
            content: [
              {
                attachment: {
                  title: "Clinical Note",
                  data: Buffer.from("Patient notes here").toString("base64"),
                },
              },
            ],
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.documents[0].attachmentTitle).toBe("Clinical Note");
    expect(result.documents[0].attachmentContent).toBe("Patient notes here");
  });

  it("parses multiple resources in one bundle", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Patient",
            gender: "male",
            name: [{ given: ["Test"], family: "User" }],
          },
        },
        {
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "bmi" }] },
            valueQuantity: { value: 25.3 },
          },
        },
        {
          resource: {
            resourceType: "DocumentReference",
            description: "Lab report",
          },
        },
      ],
    };
    const result = parseFhirBundle(bundle);
    expect(result.patient?.name).toBe("Test User");
    expect(result.observations).toHaveLength(1);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].description).toBe("Lab report");
  });
});
