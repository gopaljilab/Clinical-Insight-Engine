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

  describe("number passthrough", () => {
    it("returns positive integer as string", () => {
      expect(sanitizeCsvCell(42)).toBe("42");
    });

    it("returns negative number as string", () => {
      expect(sanitizeCsvCell(-12.5)).toBe("-12.5");
    });

    it("returns zero as string", () => {
      expect(sanitizeCsvCell(0)).toBe("0");
    });

    it("returns numeric string as-is", () => {
      expect(sanitizeCsvCell("123")).toBe("123");
    });

    it("returns negative numeric string as-is", () => {
      expect(sanitizeCsvCell("-99.9")).toBe("-99.9");
    });

    it("does not prefix numeric strings starting with plus", () => {
      expect(sanitizeCsvCell("+123")).toBe("+123");
    });
  });

  describe("plain string passthrough", () => {
    it("returns plain text unchanged", () => {
      expect(sanitizeCsvCell("hello world")).toBe("hello world");
    });

    it("preserves whitespace", () => {
      expect(sanitizeCsvCell("  leading and trailing  ")).toBe("  leading and trailing  ");
    });
  });

  describe("formula prefix detection", () => {
    it("prefixes value starting with =", () => {
      expect(sanitizeCsvCell("=HYPERLINK(\"https://evil.com\")")).toBe(
        "'=HYPERLINK(\"https://evil.com\")"
      );
    });

    it("prefixes value starting with +", () => {
      expect(sanitizeCsvCell("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
    });

    it("prefixes value starting with -", () => {
      expect(sanitizeCsvCell("-1 + 2")).toBe("'-1 + 2");
    });

    it("prefixes value starting with @", () => {
      expect(sanitizeCsvCell("@TRIM(A1)")).toBe("'@TRIM(A1)");
    });

    it("does not prefix formula-like strings that are numbers", () => {
      // "-12.5" is numeric, not a formula
      expect(sanitizeCsvCell("-12.5")).toBe("-12.5");
      expect(sanitizeCsvCell("+99")).toBe("+99");
    });

    it("does not prefix plain text without formula prefix", () => {
      expect(sanitizeCsvCell("no formula here")).toBe("no formula here");
    });

    it("trims leading whitespace before checking formula prefix", () => {
      // "  +SUM(A1)" starts with whitespace then +, so it gets prefixed
      expect(sanitizeCsvCell("  +SUM(A1)")).toBe("'  +SUM(A1)");
    });

    it("does not prefix strings that are purely whitespace", () => {
      expect(sanitizeCsvCell("   ")).toBe("   ");
    });
  });

  describe("object flattening", () => {
    it("flattens simple object to key: value pairs", () => {
      expect(sanitizeCsvCell({ name: "Alice", age: 30 })).toBe("name: Alice, age: 30");
    });

    it("flattens nested objects recursively", () => {
      expect(sanitizeCsvCell({ outer: { inner: "value" } })).toBe(
        "outer: inner: value"
      );
    });

    it("flattens arrays with semicolon separator", () => {
      expect(sanitizeCsvCell(["a", "b", "c"])).toBe("a; b; c");
    });

    it("flattens nested arrays", () => {
      expect(sanitizeCsvCell([["a", "b"], ["c"]])).toBe("a; b; c");
    });

    it("filters falsy values in arrays", () => {
      expect(sanitizeCsvCell(["a", null, "", "b"])).toBe("a; b");
    });

    it("handles mixed nested structure", () => {
      const result = sanitizeCsvCell({ items: ["x", "y"], count: 2 });
      expect(result).toContain("items: x; y");
      expect(result).toContain("count: 2");
    });

    it("serializes Date object via toISOString", () => {
      const date = new Date("2024-06-15T10:30:00.000Z");
      expect(sanitizeCsvCell(date)).toBe(date.toISOString());
    });
  });

  describe("escapeCsvCell", () => {
    it("returns sanitized value unchanged when no special chars", () => {
      expect(escapeCsvCell("normal text")).toBe("normal text");
    });

    it("wraps value containing comma in double quotes", () => {
      expect(escapeCsvCell("Doe, Jane")).toBe('"Doe, Jane"');
    });

    it("escapes double quotes inside quoted value", () => {
      expect(escapeCsvCell('say "hello"')).toBe('"say ""hello"""');
    });

    it("wraps value containing newline in double quotes", () => {
      expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    });

    it("combines sanitization and escaping for formula with comma", () => {
      // sanitizeCsvCell prefixes =, escapeCsvCell wraps in quotes due to comma
      const result = escapeCsvCell("=A1+B1");
      expect(result).toBe("'=A1+B1");
    });

    it("wraps value containing double quote in double quotes", () => {
      expect(escapeCsvCell('say "hello"')).toBe('"say ""hello"""');
    });

    it("wraps value containing carriage return in double quotes", () => {
      expect(escapeCsvCell("a\rb")).toBe('"a\rb"');
    });
  });
});
