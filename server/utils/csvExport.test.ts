import { describe, expect, it } from "vitest";
import { assessmentsToCsv } from "./csvExport";
import { escapeCsvCell, sanitizeCsvCell } from "./csvSanitizer";

describe("csvSanitizer", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(escapeCsvCell('Doe, "Jane"\nPatient')).toBe('"Doe, ""Jane""\nPatient"');
  });

  it("prefixes spreadsheet formula values", () => {
    expect(sanitizeCsvCell("=HYPERLINK(\"https://example.com\")")).toBe(
      "'=HYPERLINK(\"https://example.com\")"
    );
    expect(sanitizeCsvCell("  +SUM(A1:A2)")).toBe("'  +SUM(A1:A2)");
  });

  it("does not prefix valid numbers or numeric strings", () => {
    expect(sanitizeCsvCell(-12.5)).toBe("-12.5");
    expect(sanitizeCsvCell("-12.5")).toBe("-12.5");
    expect(sanitizeCsvCell(123)).toBe("123");
    expect(sanitizeCsvCell("123")).toBe("123");
    expect(sanitizeCsvCell("+123")).toBe("+123");
  });
});

describe("assessmentsToCsv", () => {
  it("exports sanitized CSV rows", () => {
    const csv = assessmentsToCsv([
      {
        patientName: "Jane, Doe",
        riskCategory: "=HIGH",
        notes: 'Needs "follow-up"',
      },
    ]);

    expect(csv).toBe(
      'patientName,riskCategory,notes\n"Jane, Doe",\'=HIGH,"Needs ""follow-up"""'
    );
  });

  it("serializes objects and arrays as JSON stringified values", () => {
    const csv = assessmentsToCsv([
      {
        patientName: "Jane, Doe",
        factors: [
          { name: "Age", impact: "negative", description: "Age over 65" },
        ],
      },
    ]);

    expect(csv).toBe(
      'patientName,factors\n"Jane, Doe","[{""name"":""Age"",""impact"":""negative"",""description"":""Age over 65""}]"'
    );
  });
});
