import { sanitizeCsvCell, escapeCsvCell } from "./csvSanitizer";

describe("sanitizeCsvCell", () => {
  it("returns empty string for null", () => {
    expect(sanitizeCsvCell(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(sanitizeCsvCell(undefined)).toBe("");
  });

  it("returns number as string without modification", () => {
    expect(sanitizeCsvCell(42)).toBe("42");
    expect(sanitizeCsvCell(0)).toBe("0");
    expect(sanitizeCsvCell(-99)).toBe("-99");
    expect(sanitizeCsvCell(6.5)).toBe("6.5");
    expect(sanitizeCsvCell(3.14159)).toBe("3.14159");
  });

  it("returns Date as ISO string", () => {
    const d = new Date("2026-06-13T00:00:00.000Z");
    expect(sanitizeCsvCell(d)).toBe("2026-06-13T00:00:00.000Z");
  });

  it("returns plain text without modification", () => {
    expect(sanitizeCsvCell("John Doe")).toBe("John Doe");
    expect(sanitizeCsvCell("HbA1c: 6.5%")).toBe("HbA1c: 6.5%");
  });

  it("flattens plain objects into key:value pairs", () => {
    const result = sanitizeCsvCell({ name: "Alice", age: 30 });
    expect(result).toContain("name: Alice");
    expect(result).toContain("age: 30");
  });

  it("flattens arrays with semicolon separator", () => {
    const result = sanitizeCsvCell(["x", "y", "z"]);
    expect(result).toBe("x; y; z");
  });

  it("prepends single quote for formula prefix =", () => {
    expect(sanitizeCsvCell("=HYPERLINK(\"http://evil.com\")")).toBe("'=HYPERLINK(\"http://evil.com\")");
    expect(sanitizeCsvCell("=1+1")).toBe("'=1+1");
  });

  it("prepends single quote for formula prefix +", () => {
    expect(sanitizeCsvCell("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
  });

  it("prepends single quote for formula prefix -", () => {
    expect(sanitizeCsvCell("-1+1=2")).toBe("'-1+1=2");
  });

  it("prepends single quote for formula prefix @", () => {
    expect(sanitizeCsvCell("@SUM(1,2,3)")).toBe("'@SUM(1,2,3)");
  });

  it("does NOT prepend quote for numeric strings", () => {
    expect(sanitizeCsvCell("123")).toBe("123");
    expect(sanitizeCsvCell("6.5")).toBe("6.5");
    expect(sanitizeCsvCell("0")).toBe("0");
  });
});

describe("escapeCsvCell", () => {
  it("returns sanitized value unchanged when no special chars", () => {
    expect(escapeCsvCell("Alice")).toBe("Alice");
    expect(escapeCsvCell("123")).toBe("123");
  });

  it("wraps value in double quotes when it contains comma", () => {
    expect(escapeCsvCell("Doe, Alice")).toBe('"Doe, Alice"');
  });

  it("wraps value in double quotes when it contains double quote", () => {
    expect(escapeCsvCell('Say "hello"')).toBe('"Say ""hello"""');
  });

  it("wraps value in double quotes when it contains newline", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps value in double quotes when it contains carriage return", () => {
    expect(escapeCsvCell("line1\rline2")).toBe('"line1\rline2"');
  });

  it("prepends quote for formula prefix and escapes inner double quotes", () => {
    const result = escapeCsvCell('=HYPERLINK("http://evil.com")');
    // Should prepend ' (formula escape) AND escape inner double quotes for CSV
    expect(result).toContain("'");
    expect(result).toContain('""');
  });
});
