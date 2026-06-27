import { describe, it, expect } from "vitest";
import { sanitizeCsvCell, escapeCsvCell } from "./csvSanitizer";

describe("sanitizeCsvCell", () => {
  it("returns empty string for null", () => {
    expect(sanitizeCsvCell(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(sanitizeCsvCell(undefined)).toBe("");
  });

  it("returns number as-is", () => {
    expect(sanitizeCsvCell(42)).toBe("42");
    expect(sanitizeCsvCell(-12.5)).toBe("-12.5");
  });

  it("returns Date as ISO string", () => {
    const d = new Date("2025-01-15T10:30:00.000Z");
    expect(sanitizeCsvCell(d)).toBe("2025-01-15T10:30:00.000Z");
  });

  it("returns plain string as-is when safe", () => {
    expect(sanitizeCsvCell("John Doe")).toBe("John Doe");
  });

  it("prepends single quote when cell starts with = formula prefix", () => {
    expect(sanitizeCsvCell("=HYPERLINK(...)")).toBe("'=HYPERLINK(...)");
  });

  it("prepends single quote when cell starts with + prefix", () => {
    expect(sanitizeCsvCell("+cmd")).toBe("'+cmd");
  });

  it("prepends single quote when cell starts with - prefix", () => {
    expect(sanitizeCsvCell("-malicious")).toBe("'-malicious");
  });

  it("prepends single quote when cell starts with @ prefix", () => {
    expect(sanitizeCsvCell("@calc")).toBe("'@calc");
  });

  it("returns numeric-looking string trimmed without extra quoting", () => {
    expect(sanitizeCsvCell("123")).toBe("123");
    expect(sanitizeCsvCell("42")).toBe("42");
  });

  it("flattens array values", () => {
    expect(sanitizeCsvCell(["a", "b", "c"])).toBe("a; b; c");
  });

  it("flattens object values", () => {
    expect(sanitizeCsvCell({ name: "Alice", age: 30 })).toBe("name: Alice, age: 30");
  });

  it("skips falsy values in array/object flattening", () => {
    expect(sanitizeCsvCell(["x", null, "", "y"])).toBe("x; y");
  });
});

describe("escapeCsvCell", () => {
  it("returns sanitized value as-is when no special chars", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
  });

  it("wraps value in double quotes when it contains a comma", () => {
    expect(escapeCsvCell("hello, world")).toBe('"hello, world"');
  });

  it("wraps value in double quotes when it contains a double quote (escaped)", () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps value in double quotes when it contains a newline", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps value in double quotes when it contains carriage return", () => {
    expect(escapeCsvCell("line1\rline2")).toBe('"line1\rline2"');
  });

  it("escapes formula cell wrapped in double quotes when comma present", () => {
    expect(escapeCsvCell("=A1+B1")).toBe("'=A1+B1");
    expect(escapeCsvCell("=1,2")).toBe("\"'=1,2\"");
  });
});
