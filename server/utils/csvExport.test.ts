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
      'patientName,riskCategory,notes\\n"Jane, Doe",\'=HIGH,"Needs ""follow-up"""'
    );
  });
});
