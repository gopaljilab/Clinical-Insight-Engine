import { describe, expect, it } from "vitest";
import { sanitizeCsvCell, escapeCsvCell } from "./csvSanitizer";

describe("csvSanitizer", () => {
  describe("sanitizeCsvCell", () => {
    it("escapes formula equals prefix", () => {
      expect(sanitizeCsvCell("=CMD|'calc'!A0")).toBe("'=CMD|'calc'!A0");
    });

    it("escapes formula plus prefix", () => {
      expect(sanitizeCsvCell("+SELECT * FROM users--")).toBe("'+SELECT * FROM users--");
    });

    it("escapes formula hyphen prefix", () => {
      expect(sanitizeCsvCell("-1+2")).toBe("'-1+2");
    });

    it("escapes formula at prefix", () => {
      expect(sanitizeCsvCell("@data")).toBe("'@data");
    });

    it("handles strings starting with a single quote", () => {
      // Single quote is not a formula prefix char, so it passes through
      expect(sanitizeCsvCell("'text")).toBe("'text");
    });

    it("passes plain numbers through without quotes", () => {
      expect(sanitizeCsvCell(42)).toBe("42");
      expect(sanitizeCsvCell(3.14)).toBe("3.14");
      expect(sanitizeCsvCell(-5)).toBe("-5");
    });

    it("passes plain strings without leading formula chars", () => {
      expect(sanitizeCsvCell("Hello World")).toBe("Hello World");
      expect(sanitizeCsvCell("Normal text")).toBe("Normal text");
    });

    it("returns empty string for null", () => {
      expect(sanitizeCsvCell(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(sanitizeCsvCell(undefined)).toBe("");
    });

    it("ISO-formats Date objects", () => {
      const date = new Date("2024-01-15T10:30:00.000Z");
      const result = sanitizeCsvCell(date);
      expect(result).toBe("2024-01-15T10:30:00.000Z");
    });

    it("flattens plain objects to key: value strings", () => {
      const obj = { name: "Alice", age: 30 };
      expect(sanitizeCsvCell(obj)).toBe("name: Alice, age: 30");
    });

    it("flattens nested objects", () => {
      const obj = { a: { b: 1 } };
      expect(sanitizeCsvCell(obj)).toBe("a: b: 1");
    });

    it("flattens arrays with semicolon separators", () => {
      expect(sanitizeCsvCell(["Alice", "Bob"])).toBe("Alice; Bob");
    });

    it("filters falsy items in arrays", () => {
      expect(sanitizeCsvCell(["Alice", null, "Bob"])).toBe("Alice; Bob");
    });

    it("returns string representation for unknown types", () => {
      expect(sanitizeCsvCell(true)).toBe("true");
      expect(sanitizeCsvCell(false)).toBe("false");
    });
  });

  describe("escapeCsvCell", () => {
    it("passes through clean cells unchanged", () => {
      expect(escapeCsvCell("Hello")).toBe("Hello");
      expect(escapeCsvCell(42)).toBe("42");
    });

    it("double-quotes and escapes inner quotes for cells with commas", () => {
      expect(escapeCsvCell('Hello, World')).toBe('"Hello, World"');
    });

    it("double-quotes cells with quotes and escapes inner quotes", () => {
      expect(escapeCsvCell('Say "Hello"')).toBe('"Say ""Hello"""');
    });

    it("double-quotes cells with newlines", () => {
      expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    });

    it("double-quotes cells with carriage returns", () => {
      expect(escapeCsvCell("line1\rline2")).toBe('"line1\rline2"');
    });

    it("combines sanitizeCsvCell and then escape", () => {
      // A formula-prefix cell with a comma
      expect(escapeCsvCell("=CMD,data")).toBe('"\'=CMD,data"');
    });
  });
});
