import { describe, it, expect } from "vitest";
import { sanitizeCsvCell, escapeCsvCell } from "./csvSanitizer";

describe("csvSanitizer", () => {
  describe("sanitizeCsvCell", () => {
    it("passes through plain numbers unchanged", () => {
      expect(sanitizeCsvCell(42)).toBe("42");
      expect(sanitizeCsvCell(-12.5)).toBe("-12.5");
      expect(sanitizeCsvCell(0)).toBe("0");
    });

    it("passes through numeric strings unchanged", () => {
      expect(sanitizeCsvCell("123")).toBe("123");
      expect(sanitizeCsvCell("-12.5")).toBe("-12.5");
    });

    it("prefixes formula-like strings starting with =", () => {
      expect(sanitizeCsvCell("=HYPERLINK(\"https://evil.com\")")).toBe(
        "'=HYPERLINK(\"https://evil.com\")"
      );
    });

    it("prefixes formula-like strings starting with +", () => {
      expect(sanitizeCsvCell("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
    });

    it("prefixes formula-like strings starting with -", () => {
      expect(sanitizeCsvCell("-9-1")).toBe("'-9-1");
    });

    it("prefixes formula-like strings starting with @", () => {
      expect(sanitizeCsvCell("@CONCAT(A1,B1)")).toBe("'@CONCAT(A1,B1)");
    });

    it("handles null as empty string", () => {
      expect(sanitizeCsvCell(null)).toBe("");
    });

    it("handles undefined as empty string", () => {
      expect(sanitizeCsvCell(undefined)).toBe("");
    });

    it("converts Date objects to ISO string", () => {
      const date = new Date("2026-06-13T00:00:00.000Z");
      expect(sanitizeCsvCell(date)).toBe("2026-06-13T00:00:00.000Z");
    });

    it("flattens plain objects", () => {
      expect(sanitizeCsvCell({ key: "value" })).toBe("key: value");
    });

    it("flattens nested objects recursively", () => {
      expect(sanitizeCsvCell({ a: { b: "c" }, d: 1 })).toBe("a: b: c, d: 1");
    });

    it("flattens arrays", () => {
      expect(sanitizeCsvCell(["Alice", "Bob"])).toBe("Alice; Bob");
    });

    it("converts booleans to string", () => {
      expect(sanitizeCsvCell(true)).toBe("true");
      expect(sanitizeCsvCell(false)).toBe("false");
    });

    it("handles leading whitespace on formula prefix", () => {
      expect(sanitizeCsvCell("  =CMD")).toBe("'  =CMD");
    });

    it("does not prefix plain alphanumeric text", () => {
      expect(sanitizeCsvCell("John Doe")).toBe("John Doe");
    });
  });

  describe("escapeCsvCell", () => {
    it("passes through safe strings unchanged", () => {
      expect(escapeCsvCell("Hello")).toBe("Hello");
    });

    it("wraps strings with commas in double quotes", () => {
      expect(escapeCsvCell("Doe, Jane")).toBe('"Doe, Jane"');
    });

    it("escapes double quotes inside strings", () => {
      expect(escapeCsvCell('Say "Hello"')).toBe('"Say ""Hello"""');
    });

    it("wraps strings with newlines in double quotes", () => {
      expect(escapeCsvCell("Line1\nLine2")).toBe('"Line1\nLine2"');
    });

    it("wraps strings with carriage returns in double quotes", () => {
      expect(escapeCsvCell("Line1\rLine2")).toBe('"Line1\rLine2"');
    });

    it("handles numbers unchanged", () => {
      expect(escapeCsvCell(42)).toBe("42");
    });

    it("handles null as empty string", () => {
      expect(escapeCsvCell(null)).toBe("");
    });
  });
});
