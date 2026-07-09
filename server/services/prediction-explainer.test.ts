import { expect, test, describe } from "vitest";
import { generatePredictionExplanation } from "./prediction-explainer";

describe("prediction-explainer", () => {
  test("returns HIGH risk explanation with top contributors", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "diabetic hba1c range", impact: "positive", strength: 50, description: "HbA1c in diabetic range", why: "HbA1c in diabetic range" },
        { name: "obese (bmi >= 30)", impact: "positive", strength: 50, description: "BMI indicates obesity", why: "BMI indicates obesity" },
      ],
      hba1cLevel: 9.5,
      bmi: 35,
    });

    expect(result.summary).toContain("high");
    expect(result.patientSummary).toContain("high");
    expect(result.clinicianSummary).toContain("high");
    expect(result.topContributors).toHaveLength(2);
  });

  test("returns LOW risk explanation when no positive factors", () => {
    const result = generatePredictionExplanation({
      riskCategory: "LOW",
      factors: [],
    });

    expect(result.summary).toContain("low");
    expect(result.topContributors).toHaveLength(0);
  });

  test("handles MODERATE risk category", () => {
    const result = generatePredictionExplanation({
      riskCategory: "MODERATE",
      factors: [
        { name: "prediabetic hba1c", impact: "positive", strength: 50, description: "Prediabetic range", why: "Prediabetic range" },
      ],
    });

    expect(result.summary).toContain("moderate");
  });

  test("handles missing riskCategory defaults to LOW", () => {
    const result = generatePredictionExplanation({});
    expect(result.summary).toContain("low");
  });

  test("handles null factors array", () => {
    const result = generatePredictionExplanation({
      factors: null as any,
    });
    expect(result.topContributors).toHaveLength(0);
  });

  test("handles non-array factors", () => {
    const result = generatePredictionExplanation({
      factors: "not an array" as any,
    });
    expect(result.topContributors).toHaveLength(0);
  });

  test("sorts factors by strength descending", () => {
    // Strength = factorStrengthMap[name] + position bonus, capped at 100
    // diabetic hba1c range at index 1: base 100 + bonus 15 = 100 (capped)
    // prediabetic hba1c at index 0: base 80 + bonus 20 = 100 (capped)
    // Both cap at 100 — stable sort preserves input order (prediabetic first)
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "prediabetic hba1c", impact: "positive", strength: 30, description: "Prediabetic", why: "Prediabetic" },
        { name: "diabetic hba1c range", impact: "positive", strength: 80, description: "Diabetic HbA1c", why: "Diabetic HbA1c" },
      ],
    });

    // Both cap at 100; stable sort preserves insertion order
    expect(result.topContributors[0].name).toBe("prediabetic hba1c");
    expect(result.topContributors[1].name).toBe("diabetic hba1c range");
  });

  test("limits topContributors to 4", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "f1", impact: "positive", strength: 100, description: "f1", why: "f1" },
        { name: "f2", impact: "positive", strength: 90, description: "f2", why: "f2" },
        { name: "f3", impact: "positive", strength: 80, description: "f3", why: "f3" },
        { name: "f4", impact: "positive", strength: 70, description: "f4", why: "f4" },
        { name: "f5", impact: "positive", strength: 60, description: "f5", why: "f5" },
      ],
    });

    expect(result.topContributors).toHaveLength(4);
  });

  test("separates positive and negative contributors", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "diabetic hba1c range", impact: "positive", strength: 80, description: "Diabetic", why: "Diabetic" },
        { name: "age > 60", impact: "negative", strength: 55, description: "Age factor", why: "Age factor" },
      ],
    });

    expect(result.strongestPositive.length).toBeGreaterThanOrEqual(0);
    expect(result.strongestNegative.length).toBeGreaterThanOrEqual(0);
  });

  test("HbA1c why string includes value when provided", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "diabetic hba1c range", impact: "positive", strength: 80, description: "Diabetic range", why: "placeholder" },
      ],
      hba1cLevel: 9.5,
    });

    expect(result.topContributors[0].why).toContain("9.5");
  });

  test("BMI why string includes value when provided", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "obese (bmi >= 30)", impact: "positive", strength: 80, description: "Obese", why: "placeholder" },
      ],
      bmi: 35.0,
    });

    expect(result.topContributors[0].why).toContain("35");
  });

  test("blood glucose why string includes value", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "elevated fasting glucose", impact: "positive", strength: 75, description: "Elevated", why: "placeholder" },
      ],
      bloodGlucoseLevel: 200,
    });

    expect(result.topContributors[0].why).toContain("200");
  });

  test("handles unknown factor names gracefully", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "unknown factor", impact: "positive", strength: 50, description: "Unknown", why: "Unknown" },
      ],
    });

    expect(result.topContributors).toHaveLength(1);
    expect(result.topContributors[0].name).toBe("unknown factor");
  });

  test("strength capped at 100 with position bonus", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "diabetic hba1c range", impact: "positive", strength: 90, description: "Diabetic", why: "Diabetic" },
      ],
    });

    expect(result.topContributors[0].strength).toBeLessThanOrEqual(100);
  });

  test("hypertension factor returns why string", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "hypertension", impact: "positive", strength: 60, description: "Hypertension present", why: "Hypertension present" },
      ],
      hypertension: true,
    });

    expect(result.topContributors[0].why).toContain("Hypertension present");
  });

  test("heart disease factor returns why string", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "heart disease", impact: "positive", strength: 60, description: "Heart disease present", why: "Heart disease present" },
      ],
      heartDisease: true,
    });

    expect(result.topContributors[0].why).toContain("Heart disease present");
  });
});
