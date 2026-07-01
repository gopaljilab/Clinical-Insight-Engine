import { describe, it, expect } from "vitest";
import {
  validateFhirBundle,
  parseFhirBundle,
  convertToInternalSchema,
  extractExplainableInsights,
} from "../server/services/fhirParser";

describe("fhirParser", () => {
  describe("validateFhirBundle", () => {
    it("accepts a valid FHIR Bundle", () => {
      expect(() => {
        validateFhirBundle({
          resourceType: "Bundle",
          type: "collection",
          entry: [{ resource: { resourceType: "Patient" } }],
        });
      }).not.toThrow();
    });

    it("throws for null payload", () => {
      expect(() => validateFhirBundle(null as any)).toThrow("Invalid FHIR payload");
    });

    it("throws for undefined payload", () => {
      expect(() => validateFhirBundle(undefined as any)).toThrow("Invalid FHIR payload");
    });

    it("throws for non-object payload", () => {
      expect(() => validateFhirBundle("string" as any)).toThrow("Invalid FHIR payload");
    });

    it("throws when resourceType is missing", () => {
      expect(() => validateFhirBundle({ type: "collection", entry: [] } as any)).toThrow(
        "Invalid FHIR payload",
      );
    });

    it("throws when resourceType is not Bundle", () => {
      expect(() =>
        validateFhirBundle({ resourceType: "Patient", entry: [] } as any),
      ).toThrow("Unsupported FHIR structure");
    });

    it("throws when type is missing", () => {
      expect(() =>
        validateFhirBundle({ resourceType: "Bundle", entry: [] } as any),
      ).toThrow("Unsupported FHIR structure");
    });

    it("throws when entry is missing", () => {
      expect(() =>
        validateFhirBundle({ resourceType: "Bundle", type: "collection" } as any),
      ).toThrow("Missing Bundle entries");
    });

    it("throws when entry is not an array", () => {
      expect(() =>
        validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: "not-array" } as any),
      ).toThrow("Missing Bundle entries");
    });

    it("throws when entry is empty array", () => {
      expect(() =>
        validateFhirBundle({ resourceType: "Bundle", type: "collection", entry: [] }),
      ).toThrow("Missing Bundle entries");
    });
  });

  describe("parseFhirBundle", () => {
    it("parses a Patient resource with official name", () => {
      const bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          {
            resource: {
              resourceType: "Patient",
              id: "patient-1",
              name: [{ use: "official", given: ["John"], family: "Doe" }],
              gender: "male",
              birthDate: "1980-01-15",
            },
          },
        ],
      };

      const result = parseFhirBundle(bundle);
      expect(result.patient).toBeDefined();
      expect(result.patient?.name).toBe("John Doe");
      expect(result.patient?.gender).toBe("Male");
      expect(result.patient?.birthDate).toBe("1980-01-15");
      expect(result.patient?.id).toBe("patient-1");
    });

    it("parses a Patient resource with usual name when official is absent", () => {
      const bundle = {
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

    it("parses a Patient resource falling back to first name entry", () => {
      const bundle = {
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

    it("skips entries with null resource", () => {
      const bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          { resource: null },
          {
            resource: {
              resourceType: "Patient",
              name: [{ given: ["Alice"], family: "Wonder" }],
              gender: "female",
            },
          },
        ],
      };
      const result = parseFhirBundle(bundle);
      expect(result.patient?.name).toBe("Alice Wonder");
    });

    it("skips entries without resourceType", () => {
      const bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          { resource: { id: "no-type" } },
          {
            resource: {
              resourceType: "Patient",
              name: [{ given: ["Carol"], family: "White" }],
              gender: "female",
            },
          },
        ],
      };
      const result = parseFhirBundle(bundle);
      expect(result.patient?.name).toBe("Carol White");
    });

    it("parses an Observation with valueQuantity", () => {
      const bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          {
            resource: {
              resourceType: "Observation",
              code: {
                coding: [{ code: "2339-0", display: "Glucose" }],
              },
              effectiveDateTime: "2024-01-01",
              valueQuantity: { value: 120, unit: "mg/dL" },
            },
          },
        ],
      };
      const result = parseFhirBundle(bundle);
      expect(result.observations).toHaveLength(1);
      expect(result.observations[0].code).toBe("2339-0");
      expect(result.observations[0].codeDisplay).toBe("Glucose");
      expect(result.observations[0].valueQuantity?.value).toBe(120);
      expect(result.observations[0].valueQuantity?.unit).toBe("mg/dL");
    });

    it("parses an Observation with valueString", () => {
      const bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          {
            resource: {
              resourceType: "Observation",
              code: { text: "Blood Pressure Status" },
              valueString: "elevated",
            },
          },
        ],
      };
      const result = parseFhirBundle(bundle);
      expect(result.observations[0].valueString).toBe("elevated");
      expect(result.observations[0].codeDisplay).toBe("Blood Pressure Status");
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
                  code: { coding: [{ code: "8480-6" }] },
                  valueQuantity: { value: 150 },
                },
                {
                  code: { coding: [{ code: "8462-4" }] },
                  valueQuantity: { value: 95 },
                },
              ],
            },
          },
        ],
      };
      const result = parseFhirBundle(bundle);
      expect(result.observations[0].component).toHaveLength(2);
      expect(result.observations[0].component?.[0].valueQuantity?.value).toBe(150);
    });

    it("parses a DocumentReference with attachment", () => {
      const bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          {
            resource: {
              resourceType: "DocumentReference",
              description: "Clinical note",
              type: { text: "Progress Note" },
              content: [
                {
                  attachment: {
                    title: "Note.txt",
                    data: Buffer.from("Patient is stable.").toString("base64"),
                  },
                },
              ],
            },
          },
        ],
      };
      const result = parseFhirBundle(bundle);
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].description).toBe("Clinical note");
      expect(result.documents[0].type).toBe("Progress Note");
      expect(result.documents[0].attachmentTitle).toBe("Note.txt");
      expect(result.documents[0].attachmentContent).toBe("Patient is stable.");
    });

    it("returns empty arrays for bundle with no matching resources", () => {
      const bundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          {
            resource: {
              resourceType: "Organization",
              id: "org-1",
            },
          },
        ],
      };
      const result = parseFhirBundle(bundle);
      expect(result.observations).toHaveLength(0);
      expect(result.documents).toHaveLength(0);
    });
  });

  describe("extractExplainableInsights", () => {
    it("returns default insights for empty note", () => {
      const insights = extractExplainableInsights("");
      expect(insights).toHaveLength(3);
    });

    it("extracts hypertension from BP reading", () => {
      const text = "Patient visit: BP 150/95 mmHg today.";
      const insights = extractExplainableInsights(text);
      const htInsight = insights.find((i) => i.insight === "Patient shows signs of hypertension");
      expect(htInsight?.source_snippet).toBeDefined();
    });

    it("extracts hypertension from keyword match", () => {
      const text = "History of hypertension diagnosed 5 years ago.";
      const insights = extractExplainableInsights(text);
      const htInsight = insights.find((i) => i.insight === "Patient shows signs of hypertension");
      expect(htInsight?.source_snippet).toBeDefined();
    });

    it("extracts heart disease from keyword match", () => {
      const text = "Patient has coronary artery disease confirmed.";
      const insights = extractExplainableInsights(text);
      const hdInsight = insights.find((i) =>
        i.insight === "Patient shows signs of heart disease",
      );
      expect(hdInsight?.source_snippet).toBeDefined();
    });

    it("extracts smoking history (current)", () => {
      const text = "Patient is a current smoker, 10 cigarettes per day.";
      const insights = extractExplainableInsights(text);
      const shInsight = insights.find((i) => i.insight === "Patient has a smoking history (current)");
      expect(shInsight?.source_snippet).toBeDefined();
    });

    it("extracts smoking history (former)", () => {
      const text = "Former smoker, quit 3 years ago.";
      const insights = extractExplainableInsights(text);
      const shInsight = insights.find((i) =>
        i.insight === "Patient has a smoking history (former)",
      );
      expect(shInsight?.source_snippet).toBeDefined();
    });

    it("extracts smoking history (never)", () => {
      const text = "Patient is a non-smoker with no tobacco use.";
      const insights = extractExplainableInsights(text);
      const shInsight = insights.find((i) =>
        i.insight === "Patient has a smoking history (never)",
      );
      expect(shInsight?.source_snippet).toBeDefined();
    });
  });

  describe("convertToInternalSchema", () => {
    const validStructure = {
      patient: {
        name: "John Doe",
        gender: "Male" as const,
        birthDate: "1980-01-01",
      },
      observations: [
        {
          code: "39156-5",
          codeDisplay: "BMI",
          valueQuantity: { value: 28.5 },
        },
        {
          code: "4548-4",
          codeDisplay: "HbA1c",
          valueQuantity: { value: 6.2 },
        },
        {
          code: "2339-0",
          codeDisplay: "Glucose",
          valueQuantity: { value: 110 },
        },
      ],
      documents: [],
    };

    it("converts valid FHIR structure to internal schema", () => {
      const result = convertToInternalSchema(validStructure);
      expect(result.patientName).toBe("John Doe");
      expect(result.gender).toBe("Male");
      expect(result.bmi).toBe(28.5);
      expect(result.hba1cLevel).toBe(6.2);
      expect(result.bloodGlucoseLevel).toBe(110);
      expect(result.age).toBeGreaterThan(0);
    });

    it("throws when patient is missing", () => {
      expect(() =>
        convertToInternalSchema({ patient: undefined as any, observations: [], documents: [] }),
      ).toThrow("Missing required field: Patient Name");
    });

    it("throws when patient name is empty", () => {
      const struct = { ...validStructure, patient: { ...validStructure.patient, name: "" } };
      expect(() => convertToInternalSchema(struct)).toThrow("Missing required field: Patient Name");
    });

    it("throws when gender is missing", () => {
      const struct = { ...validStructure, patient: { ...validStructure.patient, gender: undefined as any } };
      expect(() => convertToInternalSchema(struct)).toThrow("Missing required field: Gender");
    });

    it("throws when gender is invalid", () => {
      const struct = { ...validStructure, patient: { ...validStructure.patient, gender: "Unknown" as any } };
      expect(() => convertToInternalSchema(struct)).toThrow("Gender must be 'Male' or 'Female'");
    });

    it("throws when birthDate is missing", () => {
      const struct = { ...validStructure, patient: { ...validStructure.patient, birthDate: undefined as any } };
      expect(() => convertToInternalSchema(struct)).toThrow("Missing required field: Age");
    });

    it("sets hypertension from observation display", () => {
      const struct = {
        ...validStructure,
        observations: [
          ...validStructure.observations,
          { code: "x", codeDisplay: "hypertension", valueString: "yes" },
        ],
      };
      const result = convertToInternalSchema(struct);
      expect(result.hypertension).toBe(true);
    });

    it("sets heartDisease from observation display", () => {
      const struct = {
        ...validStructure,
        observations: [
          ...validStructure.observations,
          { code: "x", codeDisplay: "heart disease", valueString: "present" },
        ],
      };
      const result = convertToInternalSchema(struct);
      expect(result.heartDisease).toBe(true);
    });

    it("scans documents for clinical conditions", () => {
      const struct = {
        ...validStructure,
        documents: [{ description: "Hypertension noted in past visits." }],
      };
      const result = convertToInternalSchema(struct);
      expect(result.hypertension).toBe(true);
    });

    it("derives smoking history from observation", () => {
      const struct = {
        ...validStructure,
        observations: [
          ...validStructure.observations,
          { code: "x", codeDisplay: "smoking history", valueString: "former smoker" },
        ],
      };
      const result = convertToInternalSchema(struct);
      expect(result.smokingHistory).toBe("former");
    });
  });
});
