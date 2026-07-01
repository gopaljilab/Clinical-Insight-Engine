import { describe, it, expect } from "vitest";
import { generatePredictionExplanation } from "../server/services/prediction-explainer";

describe("prediction-explainer", () => {
  describe("generatePredictionExplanation", () => {
    it("returns explanation with all required fields", () => {
      const result = generatePredictionExplanation({
        riskCategory: "HIGH",
        factors: [],
      });
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("patientSummary");
      expect(result).toHaveProperty("clinicianSummary");
      expect(result).toHaveProperty("topContributors");
      expect(result).toHaveProperty("strongestPositive");
      expect(result).toHaveProperty("strongestNegative");
    });

    it("returns correct risk labels for HIGH, MODERATE, LOW categories", () => {
      const high = generatePredictionExplanation({ riskCategory: "HIGH", factors: [] });
      expect(high.summary).toContain("high");
      expect(high.patientSummary).toContain("high");

      const moderate = generatePredictionExplanation({ riskCategory: "MODERATE", factors: [] });
      expect(moderate.summary).toContain("moderate");
      expect(moderate.patientSummary).toContain("moderate");

      const low = generatePredictionExplanation({ riskCategory: "LOW", factors: [] });
      expect(low.summary).toContain("low");
      expect(low.patientSummary).toContain("low");
    });

    it("handles empty factors array gracefully", () => {
      const result = generatePredictionExplanation({
        riskCategory: "LOW",
        factors: [],
      });
      expect(Array.isArray(result.topContributors)).toBe(true);
      expect(Array.isArray(result.strongestPositive)).toBe(true);
      expect(Array.isArray(result.strongestNegative)).toBe(true);
    });

    it("handles undefined factors gracefully", () => {
      const result = generatePredictionExplanation({
        riskCategory: "LOW",
      });
      expect(result).toBeDefined();
      expect(Array.isArray(result.topContributors)).toBe(true);
    });

    it("sorts topContributors by strength descending", () => {
      const result = generatePredictionExplanation({
        riskCategory: "HIGH",
        factors: [
          { name: "stable profile", impact: "negative", description: "Stable profile" },
          { name: "age > 60", impact: "positive", description: "Age above 60" },
          { name: "obese (bmi >= 30)", impact: "positive", description: "BMI >= 30" },
        ],
      });
      const strengths = result.topContributors.map((c) => c.strength);
      for (let i = 1; i < strengths.length; i++) {
        expect(strengths[i - 1]).toBeGreaterThanOrEqual(strengths[i]);
      }
    });

    it("assigns correct base strengths for known factor names", () => {
      // Use negative impact for all so the sort is by index, giving predictable position bonuses.
      // Index 0: base 100, bonus 20  -> 100
      // Index 1: base 90,  bonus 15  -> 100
      // Index 2: base 60,  bonus 10  -> 70
      const result = generatePredictionExplanation({
        riskCategory: "HIGH",
        factors: [
          { name: "diabetic hba1c range", impact: "negative", description: "Diabetic range" },
          { name: "obese (bmi >= 30)", impact: "negative", description: "Obese" },
          { name: "hypertension", impact: "negative", description: "Hypertension" },
        ],
      });

      const byName: Record<string, number> = {};
      for (const c of result.topContributors) {
        byName[c.name] = c.strength;
      }

      // Both diabetic (100+20) and obese (90+15) are capped at 100 due to Math.min(100, ...)
      expect(byName["diabetic hba1c range"]).toBe(100);
      expect(byName["obese (bmi >= 30)"]).toBe(100);
      expect(byName["hypertension"]).toBe(70);
    });

    it("uses factor.impact as fallback for unknown factor names", () => {
      const result = generatePredictionExplanation({
        riskCategory: "HIGH",
        factors: [
          { name: "unknown factor", impact: "positive", description: "Unknown factor positive" },
          { name: "another unknown", impact: "negative", description: "Unknown factor negative" },
        ],
      });
      const pos = result.strongestPositive.find((c) => c.name === "unknown factor");
      const neg = result.strongestNegative.find((c) => c.name === "another unknown");
      expect(pos).toBeDefined();
      expect(neg).toBeDefined();
      expect(pos && pos.strength).toBeGreaterThan(0);
      expect(neg && neg.strength).toBeGreaterThan(0);
    });

    it("populates why field with correct value for hba1c factors", () => {
      const result = generatePredictionExplanation({
        riskCategory: "HIGH",
        hba1cLevel: 7.5,
        factors: [
          { name: "diabetic hba1c range", impact: "positive", description: "Diabetic HbA1c Range" },
        ],
      });
      const contributor = result.topContributors.find((c) => c.name === "diabetic hba1c range");
      expect(contributor).toBeDefined();
      expect(contributor && contributor.why).toContain("7.5");
      expect(contributor && contributor.why).toContain("HbA1c");
    });

    it("populates why field with correct value for bmi factors", () => {
      const result = generatePredictionExplanation({
        riskCategory: "HIGH",
        bmi: 32.5,
        factors: [{ name: "obese (bmi >= 30)", impact: "positive", description: "Obese BMI" }],
      });
      const contributor = result.topContributors.find((c) => c.name === "obese (bmi >= 30)");
      expect(contributor).toBeDefined();
      expect(contributor && contributor.why).toContain("32.5");
      expect(contributor && contributor.why).toContain("BMI");
    });

    it("populates why field with correct value for glucose factors", () => {
      const result = generatePredictionExplanation({
        riskCategory: "HIGH",
        bloodGlucoseLevel: 140,
        factors: [
          { name: "elevated fasting glucose", impact: "positive", description: "Elevated Fasting Glucose" },
        ],
      });
      const contributor = result.topContributors.find((c) =>
        c.name === "elevated fasting glucose",
      );
      expect(contributor).toBeDefined();
      expect(contributor && contributor.why).toContain("140");
    });

    it("separates positive and negative contributors correctly", () => {
      const result = generatePredictionExplanation({
        riskCategory: "HIGH",
        factors: [
          { name: "diabetic hba1c range", impact: "positive", description: "Diabetic" },
          { name: "stable profile", impact: "negative", description: "Stable" },
        ],
      });
      for (const c of result.strongestPositive) {
        expect(c.impact).toBe("positive");
      }
      for (const c of result.strongestNegative) {
        expect(c.impact).not.toBe("positive");
      }
    });

    it("handles factors with missing optional values gracefully", () => {
      const result = generatePredictionExplanation({
        riskCategory: "LOW",
        bmi: undefined,
        hba1cLevel: undefined,
        bloodGlucoseLevel: undefined,
        factors: [
          { name: "obese (bmi >= 30)", impact: "positive", description: "Obese" },
        ],
      });
      expect(result).toBeDefined();
      const obese = result.topContributors.find((c) => c.name === "obese (bmi >= 30)");
      expect(obese).toBeDefined();
    });

    it("limits topContributors to at most 4 items", () => {
      const factors = [
        { name: "diabetic hba1c range", impact: "positive", description: "A" },
        { name: "obese (bmi >= 30)", impact: "positive", description: "B" },
        { name: "hypertension", impact: "positive", description: "C" },
        { name: "heart disease", impact: "positive", description: "D" },
        { name: "age > 60", impact: "positive", description: "E" },
        { name: "smoking current", impact: "positive", description: "F" },
      ];
      const result = generatePredictionExplanation({ riskCategory: "HIGH", factors });
      expect(result.topContributors.length).toBeLessThanOrEqual(4);
    });

    it("summary text mentions risk category label", () => {
      const result = generatePredictionExplanation({ riskCategory: "MODERATE", factors: [] });
      expect(result.summary).toContain("moderate");
      expect(result.clinicianSummary).toContain("moderate");
    });
  });
});
