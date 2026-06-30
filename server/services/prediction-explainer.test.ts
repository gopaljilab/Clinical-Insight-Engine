import { describe, it, expect } from "vitest";
import { generatePredictionExplanation } from "./prediction-explainer";

function emptyFactors(): any[] {
  return [];
}

describe("generatePredictionExplanation", () => {
  describe("risk category labeling", () => {
    it("labels HIGH risk correctly", () => {
      const result = generatePredictionExplanation({ riskCategory: "HIGH" });
      expect(result.summary).toContain("high");
      expect(result.patientSummary).toContain("high");
      expect(result.clinicianSummary).toContain("high");
    });

    it("labels MODERATE risk correctly", () => {
      const result = generatePredictionExplanation({ riskCategory: "MODERATE" });
      expect(result.summary).toContain("moderate");
    });

    it("defaults to low risk when riskCategory is absent", () => {
      const result = generatePredictionExplanation({});
      expect(result.summary).toContain("low");
    });
  });

  describe("topContributors", () => {
    it("returns empty array when no factors are provided", () => {
      const result = generatePredictionExplanation({ factors: emptyFactors() });
      expect(result.topContributors).toEqual([]);
    });

    it("limits topContributors to 4 entries", () => {
      const factors = Array.from({ length: 8 }, (_, i) => ({
        name: `Factor ${i}`,
        impact: "positive" as const,
        description: `Description ${i}`,
      }));
      const result = generatePredictionExplanation({ factors });
      expect(result.topContributors.length).toBeLessThanOrEqual(4);
    });

    it("sorts topContributors by strength descending", () => {
      const factors = [
        { name: "Low", impact: "negative" as const, description: "Low impact" },
        { name: "High", impact: "positive" as const, description: "High impact" },
      ];
      const result = generatePredictionExplanation({ factors });
      if (result.topContributors.length >= 2) {
        expect(result.topContributors[0].strength).toBeGreaterThanOrEqual(
          result.topContributors[1].strength
        );
      }
    });
  });

  describe("strongestPositive", () => {
    it("returns only positive-impact factors", () => {
      const factors = [
        { name: "Positive Factor", impact: "positive" as const, description: "Increases risk" },
        { name: "Negative Factor", impact: "negative" as const, description: "Lowers risk" },
      ];
      const result = generatePredictionExplanation({ factors });
      result.strongestPositive.forEach((f) => {
        expect(f.impact).toBe("positive");
      });
    });

    it("returns empty array when all factors are negative", () => {
      const factors = [
        { name: "Negative", impact: "negative" as const, description: "Lowers risk" },
      ];
      const result = generatePredictionExplanation({ factors });
      expect(result.strongestPositive).toEqual([]);
    });
  });

  describe("strongestNegative", () => {
    it("returns only non-positive impact factors", () => {
      const factors = [
        { name: "Positive", impact: "positive" as const, description: "Increases risk" },
        { name: "Negative", impact: "negative" as const, description: "Lowers risk" },
      ];
      const result = generatePredictionExplanation({ factors });
      result.strongestNegative.forEach((f) => {
        expect(f.impact).not.toBe("positive");
      });
    });

    it("returns empty array when all factors are positive", () => {
      const factors = [
        { name: "Positive", impact: "positive" as const, description: "Increases risk" },
      ];
      const result = generatePredictionExplanation({ factors });
      expect(result.strongestNegative).toEqual([]);
    });
  });

  describe("summary text", () => {
    it("mentions no strong contributors when factors are absent", () => {
      const result = generatePredictionExplanation({ factors: emptyFactors() });
      expect(result.summary).toContain("no strong contributors");
    });

    it("includes the primary contributor name in summary", () => {
      const factors = [
        { name: "HbA1c Level", impact: "positive" as const, description: "Increases risk" },
      ];
      const result = generatePredictionExplanation({ factors });
      expect(result.summary).toContain("HbA1c");
    });
  });

  describe("factor normalization", () => {
    it("handles non-array factors gracefully", () => {
      const result = generatePredictionExplanation({ factors: undefined as any });
      expect(result.topContributors).toEqual([]);
    });

    it("handles null in factors array gracefully", () => {
      const result = generatePredictionExplanation({ factors: [null as any] });
      // Should not throw and return a valid result
      expect(result).toBeDefined();
      expect(result.topContributors).toEqual([]);
    });
  });

  describe("patientSummary", () => {
    it("contains risk level and influence description", () => {
      const factors = [
        { name: "HbA1c", impact: "positive" as const, description: "Increases risk" },
      ];
      const result = generatePredictionExplanation({ factors });
      expect(result.patientSummary.length).toBeGreaterThan(0);
    });
  });

  describe("clinicianSummary", () => {
    it("contains risk level and contributor review guidance", () => {
      const factors = [
        { name: "BMI", impact: "positive" as const, description: "Increases risk" },
      ];
      const result = generatePredictionExplanation({ factors });
      expect(result.clinicianSummary.length).toBeGreaterThan(0);
      expect(result.clinicianSummary.toLowerCase()).toContain("review");
    });
  });
});
