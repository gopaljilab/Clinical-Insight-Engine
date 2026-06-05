import { describe, expect, it } from "vitest";
import type { Assessment } from "@shared/schema";
import {
  advancedFilter,
  hasActiveMetricFilters,
  passesMetricFilters,
} from "./search_filters";

function assessment(overrides: Partial<Assessment>): Assessment {
  return {
    id: 1,
    patientName: "Jane Doe",
    gender: "Female",
    age: 48,
    hypertension: false,
    heartDisease: false,
    smokingHistory: "never",
    bmi: 24.2,
    hba1cLevel: 5.8,
    bloodGlucoseLevel: 112,
    riskScore: 31.5,
    riskCategory: "MODERATE",
    factors: [],
    confidenceInterval: null,
    modelConfidence: null,
    createdBy: "clinician@example.com",
    createdAt: new Date("2026-05-01T10:00:00Z"),
    userId: null,
    ...overrides,
  };
}

describe("advancedFilter metric triage", () => {
  const records = [
    assessment({ id: 1, bmi: 24.2, hba1cLevel: 5.8, bloodGlucoseLevel: 112, riskCategory: "LOW" }),
    assessment({ id: 2, bmi: 31.4, hba1cLevel: 7.8, bloodGlucoseLevel: 184, riskCategory: "HIGH" }),
    assessment({ id: 3, bmi: 33.1, hba1cLevel: 6.1, bloodGlucoseLevel: 142, riskCategory: "MODERATE" }),
  ];

  it("detects whether any metric bounds are active", () => {
    expect(hasActiveMetricFilters({})).toBe(false);
    expect(hasActiveMetricFilters({ bmi: { min: 30 } })).toBe(true);
    expect(hasActiveMetricFilters({ hba1cLevel: { max: null } })).toBe(false);
  });

  it("applies multiple metric ranges with AND logic", () => {
    const matches = advancedFilter(records, "", {
      bmi: { min: 30 },
      hba1cLevel: { min: 7.5 },
      bloodGlucoseLevel: { min: 150 },
    });

    expect(matches.map((item) => item.id)).toEqual([2]);
  });

  it("combines text search with numeric triage filters", () => {
    const matches = advancedFilter(records, "high", {
      bmi: { min: 30 },
      bloodGlucoseLevel: { max: 200 },
    });

    expect(matches.map((item) => item.id)).toEqual([2]);
  });

  it("searches by patient name", () => {
    const matches = advancedFilter(
      [
        assessment({ id: 1, patientName: "Jane Doe" }),
        assessment({ id: 2, patientName: "John Smith" }),
      ],
      "smith",
    );

    expect(matches.map((item) => item.id)).toEqual([2]);
  });

  it("rejects records outside a configured maximum", () => {
    expect(
      passesMetricFilters(records[2], {
        hba1cLevel: { max: 6 },
      }),
    ).toBe(false);
  });
});

describe("advancedFilter — hypertension/heartDisease yes/no search", () => {
  const noConditions = assessment({ id: 1, hypertension: false, heartDisease: false });
  const hypertensionOnly = assessment({ id: 2, hypertension: true, heartDisease: false });
  const heartDiseaseOnly = assessment({ id: 3, hypertension: false, heartDisease: true });
  const bothConditions = assessment({ id: 4, hypertension: true, heartDisease: true });
  const records = [noConditions, hypertensionOnly, heartDiseaseOnly, bothConditions];

  it("'yes' matches patients with at least one comorbidity", () => {
    const matches = advancedFilter(records, "yes");
    expect(matches.map((a) => a.id)).toEqual([2, 3, 4]);
  });

  it("'no' matches only patients with NEITHER hypertension NOR heart disease", () => {
    const matches = advancedFilter(records, "no");
    expect(matches.map((a) => a.id)).toEqual([1]);
  });

  it("'no' does NOT match a patient with hypertension but no heart disease", () => {
    const matches = advancedFilter([hypertensionOnly], "no");
    expect(matches).toHaveLength(0);
  });

  it("'no' does NOT match a patient with heart disease but no hypertension", () => {
    const matches = advancedFilter([heartDiseaseOnly], "no");
    expect(matches).toHaveLength(0);
  });
});
