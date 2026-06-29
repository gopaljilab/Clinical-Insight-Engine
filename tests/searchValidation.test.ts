/**
 * Tests for server/validation/searchValidation.ts
 */
import { describe, it, expect } from "vitest";
import {
  searchQuerySchema,
  assessmentsQuerySchema,
  cohortQuerySchema,
  assessmentExportQuerySchema,
  VALID_RISK_CATEGORIES,
} from "../server/validation/searchValidation";

describe("searchQuerySchema", () => {
  it("accepts valid search query string", () => {
    const result = searchQuerySchema.safeParse({ q: "diabetes" });
    expect(result.success).toBe(true);
  });

  it("accepts valid ISO date range", () => {
    const result = searchQuerySchema.safeParse({
      startDate: "2020-01-01",
      endDate: "2020-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid risk category", () => {
    const result = searchQuerySchema.safeParse({ riskCategory: "HIGH" });
    expect(result.success).toBe(true);
  });

  it("accepts empty params", () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts optional page and limit", () => {
    const result = searchQuerySchema.safeParse({ page: 1, limit: 20 });
    expect(result.success).toBe(true);
  });
});

describe("assessmentsQuerySchema", () => {
  it("accepts valid search query", () => {
    const result = assessmentsQuerySchema.safeParse({ q: "diabetes" });
    expect(result.success).toBe(true);
  });

  it("accepts valid ISO date range", () => {
    const result = assessmentsQuerySchema.safeParse({
      startDate: "2021-01-01",
      endDate: "2021-06-30",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid risk category", () => {
    const result = assessmentsQuerySchema.safeParse({ riskCategory: "HIGH" });
    expect(result.success).toBe(true);
  });

  it("accepts empty params", () => {
    const result = assessmentsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("cohortQuerySchema", () => {
  it("accepts valid minAge and maxAge", () => {
    const result = cohortQuerySchema.safeParse({ minAge: 18, maxAge: 65 });
    expect(result.success).toBe(true);
  });

  it("accepts valid BMI range", () => {
    const result = cohortQuerySchema.safeParse({ minBmi: 18.5, maxBmi: 30 });
    expect(result.success).toBe(true);
  });

  it("accepts valid HbA1c range", () => {
    const result = cohortQuerySchema.safeParse({ minHba1c: 4.0, maxHba1c: 8.0 });
    expect(result.success).toBe(true);
  });

  it("accepts valid glucose range", () => {
    const result = cohortQuerySchema.safeParse({ minGlucose: 70, maxGlucose: 140 });
    expect(result.success).toBe(true);
  });

  it("normalizes lowercase gender to title case", () => {
    const result = cohortQuerySchema.safeParse({ gender: "male" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBe("Male");
    }
  });

  it("normalizes gender 'female' to title case", () => {
    const result = cohortQuerySchema.safeParse({ gender: "female" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBe("Female");
    }
  });

  it("accepts smokingHistory enum values", () => {
    const never = cohortQuerySchema.safeParse({ smokingHistory: "Never" });
    expect(never.success).toBe(true);
    const former = cohortQuerySchema.safeParse({ smokingHistory: "Former" });
    expect(former.success).toBe(true);
    const current = cohortQuerySchema.safeParse({ smokingHistory: "Current" });
    expect(current.success).toBe(true);
  });

  it("accepts hypertension and heartDisease booleans", () => {
    const result = cohortQuerySchema.safeParse({
      hypertension: true,
      heartDisease: false,
    });
    expect(result.success).toBe(true);
  });

  it("normalizes riskCategory to uppercase", () => {
    const result = cohortQuerySchema.safeParse({ riskCategory: "high" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskCategory).toBe("HIGH");
    }
  });

  it("rejects invalid riskCategory", () => {
    const result = cohortQuerySchema.safeParse({ riskCategory: "EXTREME" });
    expect(result.success).toBe(false);
  });

  it("rejects negative age", () => {
    const result = cohortQuerySchema.safeParse({ minAge: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects age over 120", () => {
    const result = cohortQuerySchema.safeParse({ maxAge: 150 });
    expect(result.success).toBe(false);
  });
});

describe("assessmentExportQuerySchema", () => {
  it("accepts valid limit within range", () => {
    const result = assessmentExportQuerySchema.safeParse({ limit: 500 });
    expect(result.success).toBe(true);
  });

  it("defaults limit to 1000", () => {
    const result = assessmentExportQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(1000);
    }
  });

  it("rejects limit below minimum", () => {
    const result = assessmentExportQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects limit above maximum", () => {
    const result = assessmentExportQuerySchema.safeParse({ limit: 5000 });
    expect(result.success).toBe(false);
  });

  it("accepts string limit coerced to integer", () => {
    const result = assessmentExportQuerySchema.safeParse({ limit: "250" });
    expect(result.success).toBe(true);
  });
});

describe("VALID_RISK_CATEGORIES", () => {
  it("contains expected risk categories", () => {
    expect(VALID_RISK_CATEGORIES).toContain("LOW");
    expect(VALID_RISK_CATEGORIES).toContain("MODERATE");
    expect(VALID_RISK_CATEGORIES).toContain("HIGH");
  });
});
