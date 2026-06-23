import { describe, expect, it } from "vitest";
import { generatePredictionExplanation } from "./prediction-explainer";

describe("generatePredictionExplanation", () => {
  describe("returns correct shape", () => {
    it("returns an object with all required fields", () => {
      const result = generatePredictionExplanation({});
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("patientSummary");
      expect(result).toHaveProperty("clinicianSummary");
      expect(result).toHaveProperty("topContributors");
      expect(result).toHaveProperty("strongestPositive");
      expect(result).toHaveProperty("strongestNegative");
    });

    it("topContributors entries include name, impact, strength, why", () => {
      const result = generatePredictionExplanation({
        factors: [{ name: "HbA1c", impact: "positive", description: "high HbA1c" }],
      });
      expect(result.topContributors[0]).toMatchObject({
        name: "HbA1c",
        impact: "positive",
      });
      expect(result.topContributors[0].strength).toBeGreaterThan(0);
      expect(typeof result.topContributors[0].why).toBe("string");
    });
  });

  describe("getFactorWeight", () => {
    it("uses factorStrengthMap for known factor names", () => {
      const result = generatePredictionExplanation({
        factors: [{ name: "diabetic hba1c range", impact: "positive", description: "high" }],
      });
      expect(result.topContributors[0].strength).toBe(100);
    });

    it("uses base value from factorStrengthMap for known keys", () => {
      const result = generatePredictionExplanation({
        factors: [{ name: "prediabetic hba1c", impact: "positive", description: "elevated" }],
      });
      // strength is from factorStrengthMap or fallback + position bonus, verified > 0
      expect(result.topContributors[0].strength).toBeGreaterThan(0);
    });

    it("falls back to impact-based defaults for unknown factors (positive=50)", () => {
      const result = generatePredictionExplanation({
        factors: [{ name: "custom factor", impact: "positive", description: "custom" }],
      });
      // base 50 + position bonus 20 (index 0) = 70
      expect(result.topContributors[0].strength).toBe(70);
    });

    it("falls back to impact-based defaults for unknown factors (negative=40)", () => {
      const result = generatePredictionExplanation({
        factors: [{ name: "custom factor", impact: "negative", description: "custom" }],
      });
      // base 40 + position bonus 20 (index 0) = 60
      expect(result.topContributors[0].strength).toBe(60);
    });

    it("applies position bonus capped at 100", () => {
      // Index 0: base 40 + bonus 20 = 60
      const r0 = generatePredictionExplanation({
        factors: [
          { name: "unknown", impact: "negative", description: "d1" },
        ],
      });
      expect(r0.topContributors[0].strength).toBe(60);

      // Index 0: base 40 + bonus 20 = 60; index 1: base 40 + bonus 15 = 55
      const r1 = generatePredictionExplanation({
        factors: [
          { name: "unknown", impact: "negative", description: "d1" },
          { name: "unknown2", impact: "negative", description: "d2" },
        ],
      });
      expect(r1.topContributors[0].strength).toBe(60);
      expect(r1.topContributors[1].strength).toBe(55);

      // Position bonus: 20 - 4*5 = 0; so cap at 100 with base=100
      const r100 = generatePredictionExplanation({
        factors: [{ name: "diabetic hba1c range", impact: "positive", description: "high" }],
      });
      expect(r100.topContributors[0].strength).toBe(100); // base 100 + bonus 20, capped at 100
    });

    it("negative position bonus does not reduce weight below base", () => {
      // Index 4: bonus = max(0, 20 - 4*5) = 0; strength = 50
      // Index 5: bonus = max(0, 20 - 5*5) = 0; strength = 50
      const result = generatePredictionExplanation({
        factors: [
          { name: "unknown0", impact: "positive", description: "d1" },
          { name: "unknown1", impact: "positive", description: "d2" },
          { name: "unknown2", impact: "positive", description: "d3" },
          { name: "unknown3", impact: "positive", description: "d4" },
          { name: "unknown4", impact: "positive", description: "d5" },
        ],
      });
      // Strengths decrease with index due to position bonus, but never below base 50
      const strengths = result.topContributors.map(f => f.strength);
      // Verify strictly non-increasing order
      for (let i = 1; i < strengths.length; i++) {
        expect(strengths[i]).toBeLessThanOrEqual(strengths[i - 1]);
      }
      // Verify all are at least the base (50)
      strengths.forEach(s => {
        expect(s).toBeGreaterThanOrEqual(50);
      });
    });
  });

  describe("getFactorWhy", () => {
    it("interpolates HbA1c value into reason", () => {
      const result = generatePredictionExplanation({
        hba1cLevel: 8.5,
        factors: [{ name: "HbA1c", impact: "positive", description: "Elevated HbA1c level" }],
      });
      expect(result.topContributors[0].why).toContain("8.5%");
    });

    it("uses plain reason when hba1cLevel is absent", () => {
      const result = generatePredictionExplanation({
        factors: [{ name: "HbA1c", impact: "positive", description: "Elevated HbA1c level" }],
      });
      expect(result.topContributors[0].why).toBe("Elevated HbA1c level");
    });

    it("interpolates BMI value into reason", () => {
      const result = generatePredictionExplanation({
        bmi: 31.2,
        factors: [{ name: "BMI", impact: "negative", description: "Obese BMI" }],
      });
      expect(result.topContributors[0].why).toContain("31.2");
    });

    it("uses plain reason when bmi is absent", () => {
      const result = generatePredictionExplanation({
        factors: [{ name: "BMI", impact: "negative", description: "Obese BMI" }],
      });
      expect(result.topContributors[0].why).toBe("Obese BMI");
    });

    it("interpolates blood glucose into reason", () => {
      const result = generatePredictionExplanation({
        bloodGlucoseLevel: 180,
        factors: [{ name: "Blood glucose", impact: "positive", description: "Elevated glucose" }],
      });
      expect(result.topContributors[0].why).toContain("180");
    });

    it("appends current input for hypertension with value", () => {
      const result = generatePredictionExplanation({
        hypertension: true,
        factors: [{ name: "Hypertension", impact: "negative", description: "Has hypertension" }],
      });
      expect(result.topContributors[0].why).toContain("Current input: yes");
    });

    it("appends current input for smoking with smokingHistory", () => {
      const result = generatePredictionExplanation({
        smokingHistory: "current",
        factors: [{ name: "Smoking", impact: "negative", description: "Currently smoking" }],
      });
      expect(result.topContributors[0].why).toContain("current");
    });

    it("appends current input for smoking when smokingHistory is set", () => {
      const result = generatePredictionExplanation({
        smokingHistory: "never",
        factors: [{ name: "Smoking", impact: "negative", description: "Smoking history" }],
      });
      expect(result.topContributors[0].why).toContain("Current input: never");
    });
  });

  describe("topContributors", () => {
    it("returns top 4 contributors sorted by strength descending", () => {
      const result = generatePredictionExplanation({
        factors: [
          { name: "weak", impact: "negative", description: "d1" },
          { name: "diabetic hba1c range", impact: "positive", description: "d2" },
          { name: "prediabetic hba1c", impact: "positive", description: "d3" },
          { name: "obese (bmi >= 30)", impact: "positive", description: "d4" },
          { name: "age > 60", impact: "negative", description: "d5" },
        ],
      });
      expect(result.topContributors).toHaveLength(4);
      const strengths = result.topContributors.map(f => f.strength);
      expect(strengths).toEqual([...strengths].sort((a, b) => b - a));
    });

    it("strongestPositive contains only positive-impact contributors", () => {
      const result = generatePredictionExplanation({
        factors: [
          { name: "HbA1c", impact: "positive", description: "high" },
          { name: "BMI", impact: "negative", description: "obese" },
        ],
      });
      result.strongestPositive.forEach(f => {
        expect(f.impact).toBe("positive");
      });
    });

    it("strongestNegative contains only negative-impact contributors", () => {
      const result = generatePredictionExplanation({
        factors: [
          { name: "HbA1c", impact: "positive", description: "high" },
          { name: "BMI", impact: "negative", description: "obese" },
        ],
      });
      result.strongestNegative.forEach(f => {
        expect(f.impact).toBe("negative");
      });
    });
  });

  describe("summary text", () => {
    it("summary includes the risk label", () => {
      const result = generatePredictionExplanation({ riskCategory: "HIGH" });
      expect(result.summary).toContain("high");
    });

    it("patientSummary includes the risk label", () => {
      const result = generatePredictionExplanation({ riskCategory: "MODERATE" });
      expect(result.patientSummary).toContain("moderate");
    });

    it("clinicianSummary mentions review contributor details", () => {
      const result = generatePredictionExplanation({});
      expect(result.clinicianSummary).toContain("Review the contributor details");
    });
  });
});
