import { describe, expect, it } from "vitest";
import { buildCsvImportPreview, sanitizeImportCell } from "./csvImportPreview";

const validRow = {
  patientName: "Jane Doe",
  gender: "Female",
  age: "48",
  hypertension: "false",
  heartDisease: "0",
  smokingHistory: "never",
  bmi: "24.5",
  hba1cLevel: "5.6",
  bloodGlucoseLevel: "98",
};

describe("sanitizeImportCell", () => {
  it("neutralizes formula-like CSV values", () => {
    expect(sanitizeImportCell("=HYPERLINK(\"https://example.com\")")).toBe(
      "'=HYPERLINK(\"https://example.com\")"
    );
    expect(sanitizeImportCell("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
  });
});

describe("buildCsvImportPreview", () => {
  it("marks complete rows as valid and normalizes import payload values", () => {
    const preview = buildCsvImportPreview([validRow]);

    expect(preview.validRows).toHaveLength(1);
    expect(preview.invalidRows).toHaveLength(0);
    expect(preview.validRows[0].data).toEqual({
      patientName: "Jane Doe",
      gender: "Female",
      age: 48,
      hypertension: false,
      heartDisease: false,
      smokingHistory: "never",
      bmi: 24.5,
      hba1cLevel: 5.6,
      bloodGlucoseLevel: 98,
    });
  });

  it("reports missing required fields and malformed numeric values", () => {
    const preview = buildCsvImportPreview([
      {
        ...validRow,
        patientName: "",
        age: "forty",
        bmi: "8",
      },
    ]);

    expect(preview.validRows).toHaveLength(0);
    expect(preview.invalidRows).toHaveLength(1);
    expect(preview.invalidRows[0].errors).toContain("Patient name is required.");
    expect(preview.invalidRows[0].errors).toContain("Age must be a valid number.");
    expect(preview.invalidRows[0].errors).toContain("BMI must be between 10 and 60.");
  });

  it("detects duplicate patient rows and formula-like values without blocking unrelated valid rows", () => {
    const preview = buildCsvImportPreview([
      validRow,
      {
        ...validRow,
        patientName: "Jane Doe",
        smokingHistory: "current",
        bloodGlucoseLevel: "=99",
      },
    ]);

    expect(preview.validRows).toHaveLength(1);
    expect(preview.invalidRows).toHaveLength(1);
    expect(preview.duplicateRows).toHaveLength(2);
    expect(preview.formulaRows).toHaveLength(1);
    expect(preview.invalidRows[0].errors).toContain("Blood glucose level must be a valid number.");
    expect(preview.invalidRows[0].warnings).toContain(
      "Formula-like CSV value detected and neutralized with a leading quote."
    );
  });

  it("rejects unsupported enum values", () => {
    const preview = buildCsvImportPreview([
      {
        ...validRow,
        gender: "Other",
        smokingHistory: "sometimes",
      },
    ]);

    expect(preview.invalidRows).toHaveLength(1);
    expect(preview.invalidRows[0].errors).toContain("Gender must be Male or Female.");
    expect(preview.invalidRows[0].errors).toContain("Smoking history must be never, No Info, current, or former.");
  });
});
