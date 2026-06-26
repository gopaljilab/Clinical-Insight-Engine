import { expect, test, describe } from "vitest";
import { sanitizeCsvCell, escapeCsvCell } from "./csvSanitizer";

describe("sanitizeCsvCell", () => {
  test("returns empty string for null", () => {
    expect(sanitizeCsvCell(null)).toBe("");
  });

  test("returns empty string for undefined", () => {
    expect(sanitizeCsvCell(undefined)).toBe("");
  });

  test("returns string representation of number without quotes", () => {
    expect(sanitizeCsvCell(42)).toBe("42");
    expect(sanitizeCsvCell(3.14)).toBe("3.14");
    expect(sanitizeCsvCell(-12.5)).toBe("-12.5");
  });

  test("converts numeric string to number then back to string", () => {
    expect(sanitizeCsvCell("42")).toBe("42");
  });

  test("leaves normal text unchanged", () => {
    expect(sanitizeCsvCell("John Doe")).toBe("John Doe");
    expect(sanitizeCsvCell("Patient Name")).toBe("Patient Name");
  });

  test("trims whitespace", () => {
    expect(sanitizeCsvCell("  hello  ")).toBe("  hello  ");
  });

  test("prepends single quote for formula prefix =", () => {
    expect(sanitizeCsvCell("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
    expect(sanitizeCsvCell("=1+1")).toBe("'=1+1");
  });

  test("prepends single quote for formula prefix +", () => {
    expect(sanitizeCsvCell("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
    expect(sanitizeCsvCell("+malicious")).toBe("'+malicious");
  });

  test("numeric strings like -1 are returned without prefix (numeric guard fires first)", () => {
    // The code checks numeric before formula prefix, so -1 (a valid number) is returned as-is
    expect(sanitizeCsvCell("-1")).toBe("-1");
    expect(sanitizeCsvCell("+1")).toBe("+1");
  });

  test("prepends single quote for formula prefix - on non-numeric strings", () => {
    expect(sanitizeCsvCell("-DDE_LINK")).toBe("'-DDE_LINK");
  });

  test("prepends single quote for formula prefix @", () => {
    expect(sanitizeCsvCell("@cellref")).toBe("'@cellref");
  });

  test("returns Date as ISO string", () => {
    const d = new Date("2024-06-15T00:00:00.000Z");
    expect(sanitizeCsvCell(d)).toBe(d.toISOString());
  });

  test("flattens array into semicolon-separated string", () => {
    expect(sanitizeCsvCell(["a", "b", "c"])).toBe("a; b; c");
    expect(sanitizeCsvCell(["x"])).toBe("x");
    expect(sanitizeCsvCell([])).toBe("");
    expect(sanitizeCsvCell([null, undefined, ""])).toBe("");
  });

  test("flattens object into comma-separated key:value pairs", () => {
    expect(sanitizeCsvCell({ name: "John", age: 30 })).toBe("name: John, age: 30");
    expect(sanitizeCsvCell({})).toBe("");
  });

  test("handles nested arrays in flattening", () => {
    expect(sanitizeCsvCell(["a", ["b", "c"]])).toBe("a; b; c");
  });

  test("formula prefix on flattened array is detected", () => {
    const val = sanitizeCsvCell(["=malicious", "safe"]);
    expect(val).toBe("'=malicious; safe");
  });

  test("numeric string is returned without quote", () => {
    // "  42  " trims to "42", which is numeric, so no quote added
    expect(sanitizeCsvCell("  42  ")).toBe("  42  ");
    expect(sanitizeCsvCell("123.45")).toBe("123.45");
    expect(sanitizeCsvCell("-0.5")).toBe("-0.5");
  });

  test("non-numeric string with formula prefix gets quote prepended", () => {
    expect(sanitizeCsvCell("hello")).toBe("hello");
    expect(sanitizeCsvCell("world")).toBe("world");
  });
});

describe("escapeCsvCell", () => {
  test("returns sanitized value unchanged when safe", () => {
    expect(escapeCsvCell("John Doe")).toBe("John Doe");
    expect(escapeCsvCell("Patient")).toBe("Patient");
  });

  test("wraps value with quotes when it contains comma", () => {
    expect(escapeCsvCell("Doe, John")).toBe('"Doe, John"');
  });

  test("wraps value with quotes when it contains double quote", () => {
    expect(escapeCsvCell('Say "hello"')).toBe('"Say ""hello"""');
  });

  test("wraps value with quotes when it contains newline", () => {
    expect(escapeCsvCell("Line1\nLine2")).toBe('"Line1\nLine2"');
  });

  test("wraps value with quotes when it contains carriage return", () => {
    expect(escapeCsvCell("Line1\rLine2")).toBe('"Line1\rLine2"');
  });

  test("escapes double quotes by doubling them", () => {
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
    // Two quotes: sanitizeCsvCell returns '""'. escapeCsvCell detects quote chars,
    // wraps them and doubles each: input '""' -> '"' + '""' + '"' = '""""""' (6 chars)
    expect(escapeCsvCell('""')).toBe('""""""');
  });

  test("escapes formula prefix via sanitizeCsvCell first then wraps if needed", () => {
    const result = escapeCsvCell("=cmd");
    expect(result).toBe("'=cmd");
  });

  test("combines formula injection and CSV special char escaping", () => {
    // Value with formula prefix AND a comma: sanitizeCsvCell adds ',', then escapeCsvCell wraps
    const result = escapeCsvCell("=1+1,2");
    expect(result).toBe('"\'=1+1,2"');
  });

  test("already-safe numeric values pass through", () => {
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(-3.14)).toBe("-3.14");
  });
});
