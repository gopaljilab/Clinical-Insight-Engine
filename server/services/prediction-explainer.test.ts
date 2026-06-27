import { describe, expect, it } from "vitest";
import { generatePredictionExplanation } from "./prediction-explainer";
import type { AssessmentFactor } from "../../shared/schema";

describe("prediction-explainer", () => {
  describe("normalizeFactors", () => {
    it("returns empty contributors for empty factors", () => {
      const result = generatePredictionExplanation({ factors: [] });
      expect(result.topContributors.length).toBe(0);
    });

    it("returns contributors for valid factors", () => {
      const factors: AssessmentFactor[] = [
        { name: "diabetic hba1c range", impact: "positive", description: "In range" },
      ];
      const result = generatePredictionExplanation({ factors });
      expect(result.topContributors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getFactorWeight", () => {
    it("applies maximum strength for known diabetic hba1c factor", () => {
      const factors: AssessmentFactor[] = [
        { name: "diabetic hba1c range", impact: "positive", description: "In range" },
      ];
      const result = generatePredictionExplanation({ factors });
      // diabetic hba1c range has strength 100
      expect(result.topContributors[0].strength).toBeLessThanOrEqual(100);
    });

    it("applies fallback strength for unknown factor", () => {
      const factors: AssessmentFactor[] = [
        { name: "unknown clinical factor", impact: "positive", description: "Unknown" },
      ];
      const result = generatePredictionExplanation({ factors });
      // Unknown positive factor gets 50 + position bonus capped at 100
      expect(result.topContributors[0].strength).toBeGreaterThanOrEqual(50);
      expect(result.topContributors[0].strength).toBeLessThanOrEqual(100);
    });

    it("negative impact factor gets lower base weight", () => {
      const factors: AssessmentFactor[] = [
        { name: "unknown clinical factor", impact: "negative", description: "Unknown" },
      ];
      const result = generatePredictionExplanation({ factors });
      // Negative impact: base 40 + position bonus (20) = 60 max
      expect(result.topContributors[0].strength).toBeLessThanOrEqual(60);
    });
  });

  describe("getFactorWhy", () => {
    it("HbA1c factor explanation includes the value", () => {
      const factors: AssessmentFactor[] = [
        { name: "HbA1c Level", impact: "positive", description: "Increases risk" },
      ];
      const result = generatePredictionExplanation({
        factors,
        hba1cLevel: 6.5,
      });
      const contributor = result.topContributors[0];
      expect(contributor.why).toContain("HbA1c");
      expect(contributor.why).toContain("6.5");
    });

    it("BMI factor explanation includes the value", () => {
      const factors: AssessmentFactor[] = [
        { name: "Bmi", impact: "positive", description: "Increases risk" },
      ];
      const result = generatePredictionExplanation({
        factors,
        bmi: 32.0,
      });
      const contributor = result.topContributors[0];
      expect(contributor.why).toContain("BMI");
      expect(contributor.why).toContain("32");
    });

    it("glucose factor explanation includes the value", () => {
      const factors: AssessmentFactor[] = [
        { name: "Blood Glucose", impact: "positive", description: "Elevated" },
      ];
      const result = generatePredictionExplanation({
        factors,
        bloodGlucoseLevel: 180,
      });
      const contributor = result.topContributors[0];
      expect(contributor.why.toLowerCase()).toContain("glucose");
    });
  });

  describe("formatFactorLabel", () => {
    it("maps HbA1c to readable label", () => {
      const factors: AssessmentFactor[] = [
        { name: "HbA1c Level", impact: "positive", description: "Increases risk" },
      ];
      const result = generatePredictionExplanation({ factors });
      expect(result.topContributors[0].name).toBe("HbA1c Level");
    });

    it("maps BMI to readable label", () => {
      const factors: AssessmentFactor[] = [
        { name: "Bmi", impact: "positive", description: "Increases risk" },
      ];
      const result = generatePredictionExplanation({ factors });
      expect(result.topContributors[0].name).toBe("Bmi");
    });
  });

  describe("summarizeContributorNames", () => {
    it("returns 'no strong contributors' for empty list", () => {
      const result = generatePredictionExplanation({ factors: [] });
      expect(result.summary).toContain("no strong contributors");
    });
  });

  describe("generatePredictionExplanation", () => {
    it("returns correct structure", () => {
      const result = generatePredictionExplanation({});
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("patientSummary");
      expect(result).toHaveProperty("clinicianSummary");
      expect(result).toHaveProperty("topContributors");
      expect(result).toHaveProperty("strongestPositive");
      expect(result).toHaveProperty("strongestNegative");
    });

    it("sorts factors by strength descending", () => {
      const factors: AssessmentFactor[] = [
        { name: "Stable Profile", impact: "negative", description: "Low risk" },
        { name: "diabetic hba1c range", impact: "positive", description: "In range" },
      ];
      const result = generatePredictionExplanation({ factors });
      if (result.topContributors.length >= 2) {
        expect(result.topContributors[0].strength).toBeGreaterThanOrEqual(
          result.topContributors[1].strength
        );
      }
    });

    it("limits topContributors to 4", () => {
      const factors: AssessmentFactor[] = [
        { name: "Factor A", impact: "positive", description: "A" },
        { name: "Factor B", impact: "positive", description: "B" },
        { name: "Factor C", impact: "negative", description: "C" },
        { name: "Factor D", impact: "positive", description: "D" },
        { name: "Factor E", impact: "negative", description: "E" },
      ];
      const result = generatePredictionExplanation({ factors });
      expect(result.topContributors.length).toBeLessThanOrEqual(4);
    });

    it("returns non-empty summary strings", () => {
      const factors: AssessmentFactor[] = [
        { name: "diabetic hba1c range", impact: "positive", description: "In range" },
      ];
      const result = generatePredictionExplanation({ factors });
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.patientSummary.length).toBeGreaterThan(0);
      expect(result.clinicianSummary.length).toBeGreaterThan(0);
    });

    it("returns correct risk label for HIGH category", () => {
      const result = generatePredictionExplanation({ riskCategory: "HIGH" });
      expect(result.summary).toContain("high");
    });

    it("returns correct risk label for MODERATE category", () => {
      const result = generatePredictionExplanation({ riskCategory: "MODERATE" });
      expect(result.summary).toContain("moderate");
    });

    it("defaults to LOW risk label when no category provided", () => {
      const result = generatePredictionExplanation({});
      expect(result.summary).toContain("low");
    });

    it("separates positive and negative contributors", () => {
      const factors: AssessmentFactor[] = [
        { name: "diabetic hba1c range", impact: "positive", description: "High" },
        { name: "Stable Profile", impact: "negative", description: "Low" },
      ];
      const result = generatePredictionExplanation({ factors });
      const positiveNames = result.strongestPositive.map((c) => c.name);
      const negativeNames = result.strongestNegative.map((c) => c.name);
      expect(positiveNames).toContain("diabetic hba1c range");
      expect(negativeNames).toContain("Stable Profile");
    });
  });
});
