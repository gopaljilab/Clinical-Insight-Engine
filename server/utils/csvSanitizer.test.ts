import { describe, expect, it } from "vitest";
import { sanitizeCsvCell, escapeCsvCell } from "./csvSanitizer";

describe("sanitizeCsvCell", () => {
  it("returns empty string for null", () => {
    expect(sanitizeCsvCell(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(sanitizeCsvCell(undefined)).toBe("");
  });

  it("returns numbers as-is (String conversion)", () => {
    expect(sanitizeCsvCell(42)).toBe("42");
    expect(sanitizeCsvCell(-12.5)).toBe("-12.5");
    expect(sanitizeCsvCell(0)).toBe("0");
  });

  it("returns Date objects as ISO string", () => {
    const d = new Date("2026-06-13T10:00:00.000Z");
    expect(sanitizeCsvCell(d)).toBe(d.toISOString());
  });

  it("returns plain strings unchanged", () => {
    expect(sanitizeCsvCell("John Doe")).toBe("John Doe");
    expect(sanitizeCsvCell("")).toBe("");
  });

  it("prepends single quote to strings starting with = (formula injection)", () => {
    expect(sanitizeCsvCell("=HYPERLINK(...)")).toBe("'=HYPERLINK(...)");
    expect(sanitizeCsvCell("=2+3")).toBe("'=2+3");
  });

  it("prepends single quote to strings starting with + (formula injection)", () => {
    expect(sanitizeCsvCell("+cmd|'/C calc'!A0")).toBe("'+cmd|'/C calc'!A0");
  });

  it("prepends single quote to strings starting with - (formula injection)", () => {
    expect(sanitizeCsvCell("-1+1")).toBe("'-1+1");
  });

  it("prepends single quote to strings starting with @ (formula injection)", () => {
    expect(sanitizeCsvCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
  });

  it("numeric strings pass through without quote prefix", () => {
    expect(sanitizeCsvCell("-12.5")).toBe("-12.5");
    expect(sanitizeCsvCell("42")).toBe("42");
    expect(sanitizeCsvCell("  99  ")).toBe("  99  ");
  });

  it("flattens objects to key: value pairs", () => {
    const result = sanitizeCsvCell({ name: "John", age: 45 });
    expect(result).toContain("name:");
    expect(result).toContain("John");
    expect(result).toContain("age:");
    expect(result).toContain("45");
  });

  it("flattens arrays and joins with semicolon", () => {
    expect(sanitizeCsvCell(["a", "b", "c"])).toBe("a; b; c");
    expect(sanitizeCsvCell(["x"])).toBe("x");
    expect(sanitizeCsvCell([])).toBe("");
  });

  it("formula prefix check is case-sensitive (only =, +, -, @)", () => {
    expect(sanitizeCsvCell("=cmd")).toBe("'=cmd");
    expect(sanitizeCsvCell("=CMD")).toBe("'=CMD");
  });
});

describe("escapeCsvCell", () => {
  it("passes through plain values without wrapping", () => {
    expect(escapeCsvCell("John Doe")).toBe("John Doe");
    expect(escapeCsvCell(42)).toBe("42");
  });

  it("wraps values containing comma in double-quotes", () => {
    expect(escapeCsvCell("John, Doe")).toBe('"John, Doe"');
  });

  it("wraps values containing double-quote and escapes inner quotes", () => {
    expect(escapeCsvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it("wraps values containing carriage return in double-quotes", () => {
    expect(escapeCsvCell("line1\rline2")).toBe('"line1\rline2"');
  });

  it("wraps values containing newline in double-quotes", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("integrates with sanitizeCsvCell output", () => {
    // A formula-injection string should be sanitized AND then escaped
    const sanitized = sanitizeCsvCell("=cmd");
    expect(escapeCsvCell(sanitized)).toBe("'=cmd");
  });
});
