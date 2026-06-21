import { describe, it, expect } from "vitest";
import { validateFhirBundle, parseFhirBundle } from "./fhirParser";

describe("validateFhirBundle", () => {
  it("passes for a valid Bundle", () => {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [{ resource: { resourceType: "Patient", name: "John" } }],
    };
    expect(() => validateFhirBundle(bundle)).not.toThrow();
  });

  it("throws for null payload", () => {
    expect(() => validateFhirBundle(null)).toThrow("Invalid FHIR payload");
  });

  it("throws for undefined payload", () => {
    expect(() => validateFhirBundle(undefined)).toThrow("Invalid FHIR payload");
  });

  it("throws for non-object payload", () => {
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
    expect(() => validateFhirBundle({ resourceType: "Bundle", entry: [] })).toThrow("Unsupported FHIR structure");
  });

  it("throws when type is not a string", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", type: 123, entry: [] })).toThrow("Unsupported FHIR structure");
  });

  it("throws when entry is missing", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", type: "collection" })).toThrow("Missing Bundle entries");
  });

  it("throws when entry is not an array", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: "not-an-array" })).toThrow("Missing Bundle entries");
  });

  it("throws when entry is empty", () => {
    expect(() => validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: [] })).toThrow("Missing Bundle entries");
  });
});

describe("parseFhirBundle", () => {
  it("returns empty observations and documents for empty entry array", () => {
    const bundle = { resourceType: "Bundle", type: "collection", entry: [] };
    const result = parseFhirBundle(bundle);
    expect(result.observations).toEqual([]);
    expect(result.documents).toEqual([]);
    expect(result.patient).toBeUndefined();
  });

  it("skips entries without a resource", () => {
    const bundle = {
      resourceType: "Bundle", type: "collection",
      entry: [{ foo: "bar" }, { resource: null }, { resource: "string" }],
    };
    const result = parseFhirBundle(bundle);
    expect(result.observations).toEqual([]);
    expect(result.documents).toEqual([]);
  });

  describe("Patient resource parsing", () => {
    it("parses a minimal Patient resource", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{ resource: { resourceType: "Patient", id: "p1" } }],
      };
      const result = parseFhirBundle(bundle);
      expect(result.patient).toEqual({
        id: "p1",
        name: "",
        gender: undefined,
        birthDate: undefined,
      });
    });

    it("extracts patient name from official name", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{
          resource: {
            resourceType: "Patient",
            name: [
              { use: "official", given: ["John", "Doe"], family: "Smith" },
              { use: "usual", given: ["Johnny"], family: "Smith" },
            ],
          },
        }],
      };
      const result = parseFhirBundle(bundle);
      expect(result.patient?.name).toBe("John Doe Smith");
    });

    it("falls back to first name when no official/usual found", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{
          resource: {
            resourceType: "Patient",
            name: [{ given: ["Jane"], family: "Doe" }],
          },
        }],
      };
      const result = parseFhirBundle(bundle);
      expect(result.patient?.name).toBe("Jane Doe");
    });

    it("maps gender 'male' to 'Male'", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{ resource: { resourceType: "Patient", gender: "male" } }],
      };
      expect(parseFhirBundle(bundle).patient?.gender).toBe("Male");
    });

    it("maps gender 'female' to 'Female'", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{ resource: { resourceType: "Patient", gender: "female" } }],
      };
      expect(parseFhirBundle(bundle).patient?.gender).toBe("Female");
    });

    it("leaves gender undefined for unknown values", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{ resource: { resourceType: "Patient", gender: "other" } }],
      };
      expect(parseFhirBundle(bundle).patient?.gender).toBeUndefined();
    });

    it("parses birthDate", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{ resource: { resourceType: "Patient", birthDate: "1980-05-15" } }],
      };
      expect(parseFhirBundle(bundle).patient?.birthDate).toBe("1980-05-15");
    });
  });

  describe("Observation resource parsing", () => {
    it("parses Observation with valueQuantity", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{
          resource: {
            resourceType: "Observation",
            code: { coding: [{ code: "2339-0", display: "Blood Glucose" }] },
            effectiveDateTime: "2024-01-01T10:00:00Z",
            valueQuantity: { value: 120, unit: "mg/dL" },
          },
        }],
      };
      const obs = parseFhirBundle(bundle).observations[0];
      expect(obs.code).toBe("2339-0");
      expect(obs.codeDisplay).toBe("Blood Glucose");
      expect(obs.valueQuantity).toEqual({ value: 120, unit: "mg/dL" });
      expect(obs.effectiveDateTime).toBe("2024-01-01T10:00:00Z");
    });

    it("parses Observation with valueString", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{
          resource: {
            resourceType: "Observation",
            code: { text: "Status" },
            valueString: "active",
          },
        }],
      };
      const obs = parseFhirBundle(bundle).observations[0];
      expect(obs.valueString).toBe("active");
    });

    it("parses Observation with component array", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{
          resource: {
            resourceType: "Observation",
            code: { text: "BP Panel" },
            component: [
              {
                code: { coding: [{ code: "8480-6", display: "Systolic" }] },
                valueQuantity: { value: 145 },
              },
              {
                code: { text: "Diastolic" },
                valueQuantity: { value: 92 },
              },
            ],
          },
        }],
      };
      const obs = parseFhirBundle(bundle).observations[0];
      expect(obs.component).toHaveLength(2);
      expect(obs.component?.[0].valueQuantity?.value).toBe(145);
      expect(obs.component?.[1].valueQuantity?.value).toBe(92);
    });

    it("handles missing optional fields gracefully", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{
          resource: { resourceType: "Observation" },
        }],
      };
      const obs = parseFhirBundle(bundle).observations[0];
      expect(obs.code).toBe("");
      expect(obs.codeDisplay).toBe("");
      expect(obs.valueQuantity).toBeUndefined();
      expect(obs.valueString).toBeUndefined();
      expect(obs.component).toBeUndefined();
    });
  });

  describe("DocumentReference resource parsing", () => {
    it("parses DocumentReference with description and type", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{
          resource: {
            resourceType: "DocumentReference",
            description: "Clinical note",
            type: { text: "Progress Note" },
          },
        }],
      };
      const doc = parseFhirBundle(bundle).documents[0];
      expect(doc.description).toBe("Clinical note");
      expect(doc.type).toBe("Progress Note");
    });

    it("parses DocumentReference with base64 attachment", () => {
      // "SGVsbG8=" is "Hello" in base64
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{
          resource: {
            resourceType: "DocumentReference",
            content: [{
              attachment: {
                title: "Note.txt",
                data: "SGVsbG8=",
              },
            }],
          },
        }],
      };
      const doc = parseFhirBundle(bundle).documents[0];
      expect(doc.attachmentTitle).toBe("Note.txt");
      expect(doc.attachmentContent).toBe("Hello");
    });

    it("handles invalid base64 gracefully", () => {
      // Buffer.from does not throw for invalid base64 in Node.js - it decodes
      // with replacement characters. Test that it does not crash.
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{
          resource: {
            resourceType: "DocumentReference",
            content: [{
              attachment: { title: "Bad.txt", data: "!!!invalid!!!" },
            }],
          },
        }],
      };
      const doc = parseFhirBundle(bundle).documents[0];
      expect(doc.attachmentTitle).toBe("Bad.txt");
      // Does not throw - returns some decoded result or undefined
      expect(doc.attachmentContent === undefined || typeof doc.attachmentContent === "string").toBe(true);
    });

    it("handles missing content gracefully", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [{
          resource: { resourceType: "DocumentReference" },
        }],
      };
      const doc = parseFhirBundle(bundle).documents[0];
      expect(doc.description).toBeUndefined();
      expect(doc.type).toBeUndefined();
    });
  });

  describe("mixed entry types", () => {
    it("parses Patient, Observation, and DocumentReference in one bundle", () => {
      const bundle = {
        resourceType: "Bundle", type: "collection",
        entry: [
          {
            resource: {
              resourceType: "Patient",
              id: "p1",
              name: [{ given: ["Alice"], family: "Smith" }],
              gender: "female",
              birthDate: "1975-03-10",
            },
          },
          {
            resource: {
              resourceType: "Observation",
              code: { coding: [{ code: "4548-4", display: "HbA1c" }] },
              valueQuantity: { value: 6.8, unit: "%" },
            },
          },
          {
            resource: {
              resourceType: "DocumentReference",
              description: "Lab summary",
            },
          },
        ],
      };
      const result = parseFhirBundle(bundle);
      expect(result.patient?.name).toBe("Alice Smith");
      expect(result.patient?.gender).toBe("Female");
      expect(result.observations).toHaveLength(1);
      expect(result.observations[0].code).toBe("4548-4");
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].description).toBe("Lab summary");
    });
  });
});
