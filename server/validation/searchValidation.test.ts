import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  detectSqlInjectionPattern,
  isIso8601Date,
  VALID_RISK_CATEGORIES,
  searchQuerySchema,
  assessmentsQuerySchema,
} from "./searchValidation";

describe("detectSqlInjectionPattern", () => {
  it("returns null for safe strings", () => {
    expect(detectSqlInjectionPattern("John Doe")).toBeNull();
    expect(detectSqlInjectionPattern("patient123")).toBeNull();
    expect(detectSqlInjectionPattern("Normal search query")).toBeNull();
  });

  it("detects OR 1=1 pattern", () => {
    expect(detectSqlInjectionPattern("' OR '1'='1")).not.toBeNull();
  });

  it("detects UNION SELECT pattern", () => {
    expect(detectSqlInjectionPattern("UNION SELECT * FROM users")).not.toBeNull();
  });

  it("detects DROP TABLE pattern", () => {
    expect(detectSqlInjectionPattern("'; DROP TABLE users;--")).not.toBeNull();
  });

  it("detects SQL comment pattern", () => {
    expect(detectSqlInjectionPattern("patient -- comment")).not.toBeNull();
  });

  it("detects INFORMATION_SCHEMA enumeration", () => {
    expect(detectSqlInjectionPattern("INFORMATION_SCHEMA.tables")).not.toBeNull();
  });
});

describe("isIso8601Date", () => {
  it("returns true for valid ISO 8601 dates", () => {
    expect(isIso8601Date("2024-01-15")).toBe(true);
    expect(isIso8601Date("2023-12-31")).toBe(true);
  });

  it("returns false for ambiguous MM/DD/YYYY format", () => {
    expect(isIso8601Date("01/15/2024")).toBe(false);
    expect(isIso8601Date("12/31/2023")).toBe(false);
  });

  it("returns false for invalid dates", () => {
    expect(isIso8601Date("not-a-date")).toBe(false);
    expect(isIso8601Date("")).toBe(false);
  });

  it("returns true for undefined", () => {
    expect(isIso8601Date(undefined)).toBe(true);
  });
});

describe("VALID_RISK_CATEGORIES", () => {
  it("contains expected values", () => {
    expect(VALID_RISK_CATEGORIES).toContain("LOW");
    expect(VALID_RISK_CATEGORIES).toContain("MODERATE");
    expect(VALID_RISK_CATEGORIES).toContain("HIGH");
    expect(VALID_RISK_CATEGORIES).toHaveLength(3);
  });
});

describe("searchQuerySchema", () => {
  it("accepts valid search query", () => {
    const result = searchQuerySchema.safeParse({ q: "John Doe" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects query exceeding max length", () => {
    const longQuery = "a".repeat(201);
    const result = searchQuerySchema.safeParse({ q: longQuery });
    expect(result.success).toBe(false);
  });

  it("rejects invalid characters in query", () => {
    const result = searchQuerySchema.safeParse({ q: "John<script>alert(1)</script>" });
    expect(result.success).toBe(false);
  });

  it("accepts valid risk category", () => {
    const result = searchQuerySchema.safeParse({ q: "test", riskCategory: "HIGH" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid risk category", () => {
    const result = searchQuerySchema.safeParse({ q: "test", riskCategory: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("accepts valid limit", () => {
    const result = searchQuerySchema.safeParse({ q: "test", limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects limit exceeding 100", () => {
    const result = searchQuerySchema.safeParse({ q: "test", limit: "150" });
    expect(result.success).toBe(false);
  });
});

describe("assessmentsQuerySchema", () => {
  it("accepts valid params", () => {
    const result = assessmentsQuerySchema.safeParse({ page: "1", limit: "20" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid sortBy", () => {
    const result = assessmentsQuerySchema.safeParse({ sortBy: "invalidField" });
    expect(result.success).toBe(false);
  });

  it("accepts valid sortBy", () => {
    const result = assessmentsQuerySchema.safeParse({ sortBy: "riskScore" });
    expect(result.success).toBe(true);
  });

  it("normalizes gender to title case", () => {
    const result = assessmentsQuerySchema.safeParse({ gender: "male" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBe("Male");
    }
  });

  it("rejects out-of-range age", () => {
    const result = assessmentsQuerySchema.safeParse({ minAge: -5 });
    expect(result.success).toBe(false);
    const result2 = assessmentsQuerySchema.safeParse({ maxAge: 200 });
    expect(result2.success).toBe(false);
  });
});
