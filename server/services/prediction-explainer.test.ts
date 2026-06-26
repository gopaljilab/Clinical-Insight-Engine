import { describe, it, expect } from "vitest";
import { generatePredictionExplanation } from "./prediction-explainer";
import type { AssessmentFactor } from "@shared/schema";

function makeFactor(
  name: string,
  impact: "positive" | "negative",
  description: string
): AssessmentFactor {
  return { name, impact, description };
}

describe("generatePredictionExplanation", () => {
  it("generates explanation with empty factors", () => {
    const result = generatePredictionExplanation({});
    expect(result.summary).toContain("low");
    expect(result.patientSummary).toBeTruthy();
    expect(result.clinicianSummary).toBeTruthy();
    expect(result.topContributors).toHaveLength(0);
    expect(result.strongestPositive).toHaveLength(0);
    expect(result.strongestNegative).toHaveLength(0);
  });

  it("assigns strength to factors using known factor map", () => {
    const result = generatePredictionExplanation({
      factors: [makeFactor("diabetic hba1c range", "positive", "High HbA1c level")],
    });

    expect(result.topContributors).toHaveLength(1);
    expect(result.topContributors[0].strength).toBe(100);
  });

  it("assigns unknown factor a default weight", () => {
    const result = generatePredictionExplanation({
      factors: [makeFactor("unknown factor", "positive", "Some description")],
    });

    expect(result.topContributors[0].strength).toBeGreaterThan(0);
    expect(result.topContributors[0].strength).toBeLessThanOrEqual(100);
  });

  it("applies position bonus to lower-indexed factors", () => {
    const result = generatePredictionExplanation({
      factors: [
        makeFactor("diabetic hba1c range", "positive", "High HbA1c"),
        makeFactor("prediabetic hba1c", "positive", "Prediabetic HbA1c"),
      ],
    });

    // First factor should have higher strength (base 100 + position bonus)
    expect(result.topContributors[0].strength).toBeGreaterThanOrEqual(
      result.topContributors[1].strength
    );
  });

  it("caps strength at 100", () => {
    const result = generatePredictionExplanation({
      factors: [makeFactor("diabetic hba1c range", "positive", "High HbA1c")],
    });

    expect(result.topContributors[0].strength).toBeLessThanOrEqual(100);
  });

  it("sorts contributors by strength descending", () => {
    const result = generatePredictionExplanation({
      factors: [
        makeFactor("stable profile", "negative", "Low risk"),
        makeFactor("diabetic hba1c range", "positive", "High HbA1c"),
      ],
    });

    expect(result.topContributors[0].strength).toBeGreaterThanOrEqual(
      result.topContributors[1].strength
    );
  });

  it("populates strongestPositive and strongestNegative separately", () => {
    const result = generatePredictionExplanation({
      factors: [
        makeFactor("diabetic hba1c range", "positive", "High HbA1c"),
        makeFactor("stable profile", "negative", "Low risk"),
      ],
    });

    expect(result.strongestPositive).toHaveLength(1);
    expect(result.strongestPositive[0].impact).toBe("positive");
    expect(result.strongestNegative).toHaveLength(1);
    expect(result.strongestNegative[0].impact).toBe("negative");
  });

  it("limits topContributors to 4", () => {
    const result = generatePredictionExplanation({
      factors: [
        makeFactor("diabetic hba1c range", "positive", "High HbA1c"),
        makeFactor("prediabetic hba1c", "positive", "Prediabetic HbA1c"),
        makeFactor("hyperglycemia", "positive", "Hyperglycemia"),
        makeFactor("elevated fasting glucose", "positive", "Elevated glucose"),
        makeFactor("obese (bmi >= 30)", "positive", "Obese"),
      ],
    });

    expect(result.topContributors).toHaveLength(4);
  });

  it("generates HIGH risk summary for HIGH category", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [makeFactor("diabetic hba1c range", "positive", "High HbA1c")],
    });

    expect(result.summary).toContain("high");
    expect(result.patientSummary).toContain("high");
    expect(result.clinicianSummary).toContain("high");
  });

  it("generates moderate summary for MODERATE category", () => {
    const result = generatePredictionExplanation({
      riskCategory: "MODERATE",
      factors: [makeFactor("prediabetic hba1c", "positive", "Prediabetic HbA1c")],
    });

    expect(result.summary).toContain("moderate");
  });

  it("normalizes riskCategory to uppercase", () => {
    const result = generatePredictionExplanation({
      riskCategory: "high",
      factors: [makeFactor("diabetic hba1c range", "positive", "High HbA1c")],
    });

    expect(result.summary).toContain("high");
  });

  it("sets default LOW risk when riskCategory is absent", () => {
    const result = generatePredictionExplanation({});
    expect(result.summary).toContain("low");
  });

  it("includes 'why' field with HbA1c formatting", () => {
    const result = generatePredictionExplanation({
      hba1cLevel: 8.5,
      factors: [makeFactor("diabetic hba1c range", "positive", "High HbA1c level")],
    });

    expect(result.topContributors[0].why).toContain("8.5");
    expect(result.topContributors[0].why).toContain("HbA1c");
  });

  it("includes 'why' field with BMI formatting", () => {
    const result = generatePredictionExplanation({
      bmi: 32.1,
      factors: [makeFactor("obese (bmi >= 30)", "positive", "Obese BMI")],
    });

    expect(result.topContributors[0].why).toContain("32.1");
    expect(result.topContributors[0].why).toContain("BMI");
  });

  it("includes 'why' field with blood glucose formatting", () => {
    const result = generatePredictionExplanation({
      bloodGlucoseLevel: 150,
      factors: [makeFactor("elevated fasting glucose", "positive", "Elevated blood glucose")],
    });

    expect(result.topContributors[0].why).toContain("150");
    expect(result.topContributors[0].why).toContain("glucose");
  });

  it("includes 'why' field with hypertension flag", () => {
    const result = generatePredictionExplanation({
      hypertension: true,
      factors: [makeFactor("hypertension", "positive", "Hypertension present")],
    });

    expect(result.topContributors[0].why).toContain("yes");
  });

  it("includes 'why' field with heart disease flag", () => {
    const result = generatePredictionExplanation({
      heartDisease: true,
      factors: [makeFactor("heart disease", "positive", "Heart disease present")],
    });

    expect(result.topContributors[0].why).toContain("yes");
  });

  it("includes smoking history value in 'why' field", () => {
    const result = generatePredictionExplanation({
      smokingHistory: "current",
      factors: [makeFactor("smoking", "positive", "Smoking history present")],
    });

    expect(result.topContributors[0].why).toContain("current");
  });

  it("handles non-array factors input gracefully", () => {
    const result = generatePredictionExplanation({
      // @ts-ignore - testing runtime behavior
      factors: "not an array",
    });

    expect(result.topContributors).toHaveLength(0);
    expect(result.summary).toBeTruthy();
  });

  it("includes topContributors with all expected fields", () => {
    const factor = makeFactor("diabetic hba1c range", "positive", "High HbA1c");
    const result = generatePredictionExplanation({ factors: [factor] });

    const contrib = result.topContributors[0];
    expect(contrib).toHaveProperty("name", "diabetic hba1c range");
    expect(contrib).toHaveProperty("impact", "positive");
    expect(contrib).toHaveProperty("description", "High HbA1c");
    expect(contrib).toHaveProperty("strength");
    expect(contrib).toHaveProperty("why");
  });
});
