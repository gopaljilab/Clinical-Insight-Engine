import { describe, expect, it } from "vitest";
import { sanitizeCsvCell, escapeCsvCell } from "./csvSanitizer";

describe("sanitizeCsvCell", () => {
  describe("null and undefined handling", () => {
    it("returns empty string for null", () => {
      expect(sanitizeCsvCell(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(sanitizeCsvCell(undefined)).toBe("");
    });
  });

  describe("numeric values", () => {
    it("returns numeric string for number type", () => {
      expect(sanitizeCsvCell(42)).toBe("42");
    });

    it("returns numeric string for float", () => {
      expect(sanitizeCsvCell(3.14159)).toBe("3.14159");
    });

    it("returns negative numbers as-is", () => {
      expect(sanitizeCsvCell(-12.5)).toBe("-12.5");
    });
  });

  describe("string values", () => {
    it("returns plain string unchanged", () => {
      expect(sanitizeCsvCell("hello world")).toBe("hello world");
    });

    it("preserves whitespace in string values", () => {
      // The function does not trim string content
      expect(sanitizeCsvCell("  patient name  ")).toBe("  patient name  ");
    });

    it("preserves whitespace-only strings", () => {
      expect(sanitizeCsvCell("   ")).toBe("   ");
    });
  });

  describe("formula injection prevention (OWASP CSV Injection)", () => {
    it("prepends single quote for = prefix", () => {
      expect(sanitizeCsvCell("=HYPERLINK(\"https://evil.com\")")).toBe(
        "'=HYPERLINK(\"https://evil.com\")"
      );
    });

    it("prepends single quote for + prefix", () => {
      expect(sanitizeCsvCell("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
    });

    it("does not prefix -10 because it parses as a valid number", () => {
      // Numeric strings (including negative) are treated as numbers, not formulas
      expect(sanitizeCsvCell("-10")).toBe("-10");
    });

    it("prepends single quote for @ prefix", () => {
      expect(sanitizeCsvCell("@MAIL()")).toBe("'@MAIL()");
    });

    it("prepends single quote for tab-prefixed content", () => {
      expect(sanitizeCsvCell("\t=CMD")).toBe("'\t=CMD");
    });

    it("prepends single quote for CR-prefixed content", () => {
      expect(sanitizeCsvCell("\r=CMD")).toBe("'\r=CMD");
    });

    it("prepends single quote for LF-prefixed content", () => {
      expect(sanitizeCsvCell("\n=CMD")).toBe("'\n=CMD");
    });

    it("prepends single quote for whitespace-then-equals", () => {
      // After trimStart, starts with '=' so formula prefix applies
      expect(sanitizeCsvCell("  = hello")).toBe("'  = hello");
    });
  });

  describe("numeric strings", () => {
    it("preserves numeric strings without quote prefix", () => {
      expect(sanitizeCsvCell("123")).toBe("123");
      expect(sanitizeCsvCell("-456")).toBe("-456");
      expect(sanitizeCsvCell("+789")).toBe("+789");
    });

    it("preserves whitespace-prefixed numeric strings (no trimming)", () => {
      expect(sanitizeCsvCell("  42")).toBe("  42");
    });
  });

  describe("Date objects", () => {
    it("returns ISO string for Date", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      expect(sanitizeCsvCell(date)).toBe("2024-01-15T10:30:00.000Z");
    });
  });

  describe("nested object flattening", () => {
    it("flattens nested objects into key: value pairs", () => {
      const result = sanitizeCsvCell({ name: "John", age: 30 });
      expect(result).toBe("name: John, age: 30");
    });

    it("flattens arrays within objects", () => {
      const result = sanitizeCsvCell({
        tags: ["urgent", "cardiac"],
      });
      expect(result).toBe("tags: urgent; cardiac");
    });
  });
});

describe("escapeCsvCell", () => {
  it("returns plain strings unchanged", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
  });

  it("escapes double quotes by doubling them", () => {
    expect(escapeCsvCell('Hello "World"')).toBe('"Hello ""World"""');
  });

  it("escapes commas", () => {
    expect(escapeCsvCell("Doe, John")).toBe('"Doe, John"');
  });

  it("escapes newlines", () => {
    expect(escapeCsvCell("Line1\nLine2")).toBe('"Line1\nLine2"');
  });

  it("escapes carriage returns", () => {
    expect(escapeCsvCell("Line1\rLine2")).toBe('"Line1\rLine2"');
  });

  it("escapes combined quotes commas and newlines", () => {
    expect(escapeCsvCell('Hello, "World"\nNew line')).toBe(
      '"Hello, ""World""\nNew line"'
    );
  });

  it("handles empty string", () => {
    expect(escapeCsvCell("")).toBe("");
  });

  it("escapes already-sanitized values correctly", () => {
    // Single quote inside value gets doubled when wrapped in quotes
    const alreadySanitized = "'=HYPERLINK(\"https://x.com\")";
    const escaped = escapeCsvCell(alreadySanitized);
    expect(escaped).toBe(
      "\"'=HYPERLINK(\"\"https://x.com\"\")\""
    );
  });
});
