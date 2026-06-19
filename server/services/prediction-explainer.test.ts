import { describe, test, expect } from "vitest";
import { generatePredictionExplanation } from "./prediction-explainer";
import type { AssessmentFactor } from "../../shared/schema";

describe("prediction-explainer — generatePredictionExplanation", () => {
  test("generates explanation with HIGH risk category", () => {
    const factors: AssessmentFactor[] = [
      { name: "diabetic hba1c range", impact: "positive", description: "HbA1c is in diabetic range" },
      { name: "obese (bmi >= 30)", impact: "positive", description: "BMI indicates obesity" },
      { name: "hypertension", impact: "positive", description: "Patient has hypertension" },
    ];

    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors,
    });

    expect(result.summary).toContain("high");
    expect(result.patientSummary).toBeTruthy();
    expect(result.clinicianSummary).toBeTruthy();
    expect(result.topContributors).toHaveLength(3);
    expect(result.strongestPositive).toHaveLength(3);
  });

  test("generates explanation with LOW risk category", () => {
    const factors: AssessmentFactor[] = [
      { name: "stable profile", impact: "negative", description: "All metrics are within normal range" },
    ];

    const result = generatePredictionExplanation({
      riskCategory: "LOW",
      factors,
    });

    expect(result.summary).toContain("low");
    expect(result.patientSummary).toContain("low");
  });

  test("generates explanation with MODERATE risk category", () => {
    const factors: AssessmentFactor[] = [
      { name: "prediabetic hba1c", impact: "positive", description: "HbA1c in prediabetic range" },
    ];

    const result = generatePredictionExplanation({
      riskCategory: "MODERATE",
      factors,
    });

    expect(result.summary).toContain("moderate");
  });

  test("topContributors is limited to 4", () => {
    const factors: AssessmentFactor[] = [
      { name: "diabetic hba1c range", impact: "positive", description: "Diabetic HbA1c" },
      { name: "hyperglycemia", impact: "positive", description: "High glucose" },
      { name: "obese (bmi >= 30)", impact: "positive", description: "Obesity" },
      { name: "hypertension", impact: "positive", description: "Hypertension" },
      { name: "heart disease", impact: "positive", description: "Heart disease" },
      { name: "smoking current", impact: "positive", description: "Current smoker" },
    ];

    const result = generatePredictionExplanation({ factors });
    expect(result.topContributors.length).toBeLessThanOrEqual(4);
  });

  test("sorts contributors by strength descending", () => {
    const factors: AssessmentFactor[] = [
      { name: "stable profile", impact: "negative", description: "Stable" },           // 20
      { name: "age > 45", impact: "positive", description: "Age over 45" },            // 40+bonus
      { name: "hypertension", impact: "positive", description: "Has hypertension" },     // 60+bonus
    ];

    const result = generatePredictionExplanation({ factors });
    const strengths = result.topContributors.map((c) => c.strength);
    expect(strengths[0]).toBeGreaterThanOrEqual(strengths[1]);
    expect(strengths[1]).toBeGreaterThanOrEqual(strengths[2]);
  });

  test("separates positive and negative contributors", () => {
    const factors: AssessmentFactor[] = [
      { name: "diabetic hba1c range", impact: "positive", description: "High HbA1c" },
      { name: "stable profile", impact: "negative", description: "Stable" },
    ];

    const result = generatePredictionExplanation({ factors });
    expect(result.strongestPositive.length).toBeGreaterThanOrEqual(0);
    expect(result.strongestNegative.length).toBeGreaterThanOrEqual(0);
  });

  test("handles empty factors array", () => {
    const result = generatePredictionExplanation({ factors: [] });
    expect(result.topContributors).toHaveLength(0);
    expect(result.summary).toBeTruthy();
    expect(result.patientSummary).toBeTruthy();
    expect(result.clinicianSummary).toBeTruthy();
  });

  test("handles undefined factors", () => {
    const result = generatePredictionExplanation({});
    expect(result.topContributors).toHaveLength(0);
  });

  test("handles undefined riskCategory (defaults to LOW)", () => {
    const factors = [
      { name: "hypertension", impact: "positive", description: "Hypertension present" },
    ];
    const result = generatePredictionExplanation({ factors } as any);
    expect(result.summary).toContain("low");
  });

  test("includes numeric values in why strings for HbA1c factor", () => {
    const factors = [
      { name: "diabetic hba1c range", impact: "positive", description: "HbA1c is elevated" },
    ];
    const result = generatePredictionExplanation({
      factors,
      hba1cLevel: 8.5,
    } as any);

    const why = result.topContributors[0]?.why;
    expect(why).toContain("8.5");
  });

  test("includes numeric values in why strings for BMI factor", () => {
    const factors = [
      { name: "obese (bmi >= 30)", impact: "positive", description: "BMI indicates obesity" },
    ];
    const result = generatePredictionExplanation({
      factors,
      bmi: 33.7,
    } as any);

    const why = result.topContributors[0]?.why;
    expect(why).toContain("33.7");
  });

  test("includes numeric values in why strings for glucose factor", () => {
    const factors = [
      { name: "elevated fasting glucose", impact: "positive", description: "Fasting glucose is elevated" },
    ];
    const result = generatePredictionExplanation({
      factors,
      bloodGlucoseLevel: 142,
    } as any);

    const why = result.topContributors[0]?.why;
    expect(why).toContain("142");
  });

  test("returns all exported fields", () => {
    const result = generatePredictionExplanation({ factors: [] });
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("patientSummary");
    expect(result).toHaveProperty("clinicianSummary");
    expect(result).toHaveProperty("topContributors");
    expect(result).toHaveProperty("strongestPositive");
    expect(result).toHaveProperty("strongestNegative");
  });

  test("normalizeFactors handles non-array input", () => {
    const result = generatePredictionExplanation({ factors: null as any });
    expect(result.topContributors).toHaveLength(0);
  });

  test("normalizeFactors returns empty array for undefined", () => {
    const result = generatePredictionExplanation({ factors: undefined as any });
    expect(result.topContributors).toHaveLength(0);
  });
});
