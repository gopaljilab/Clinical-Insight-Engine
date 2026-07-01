import { describe, it, expect } from "vitest";
import { generateAttentionNavigator } from "../server/services/clinical-attention-navigator";

describe("clinical-attention-navigator", () => {
  describe("generateAttentionNavigator", () => {
    it("returns a navigator with priorities array", () => {
      const result = generateAttentionNavigator({});
      expect(result).toHaveProperty("priorities");
      expect(Array.isArray(result.priorities)).toBe(true);
    });

    it("returns non-empty priorities for HIGH risk category", () => {
      const result = generateAttentionNavigator({ riskCategory: "HIGH" });
      const riskCatEntry = result.priorities.find((p) => p.factor === "Risk category");
      expect(riskCatEntry).toBeDefined();
      expect(riskCatEntry?.priority).toBe("high");
    });

    it("returns moderate risk category priority for MODERATE input", () => {
      const result = generateAttentionNavigator({ riskCategory: "MODERATE" });
      const riskCatEntry = result.priorities.find((p) => p.factor === "Risk category");
      expect(riskCatEntry).toBeDefined();
      expect(riskCatEntry?.priority).toBe("moderate");
    });

    it("omits risk category priority for LOW risk", () => {
      const result = generateAttentionNavigator({ riskCategory: "LOW" });
      const riskCatEntry = result.priorities.find((p) => p.factor === "Risk category");
      expect(riskCatEntry).toBeUndefined();
    });

    it("prioritizes HIGH when both HIGH and MODERATE factors present", () => {
      const result = generateAttentionNavigator({
        riskCategory: "HIGH",
        hba1cLevel: 10,
        bmi: 27,
      });
      const priorities = result.priorities.map((p) => p.priority);
      expect(priorities).not.toContain("moderate");
    });

    it("returns correct HbA1c priorities for critical / elevated / acceptable values", () => {
      const critical = generateAttentionNavigator({ hba1cLevel: 10 });
      const elevated = generateAttentionNavigator({ hba1cLevel: 8 });
      const normal = generateAttentionNavigator({ hba1cLevel: 5.5 });

      const findHbA1c = (r: ReturnType<typeof generateAttentionNavigator>) =>
        r.priorities.find((p) => p.factor === "HbA1c");

      expect(findHbA1c(critical)?.priority).toBe("high");
      expect(findHbA1c(elevated)?.priority).toBe("moderate");
      expect(findHbA1c(normal)?.priority).toBe("monitor");
    });

    it("returns correct Blood Glucose priorities for critical / elevated / normal values", () => {
      const critical = generateAttentionNavigator({ bloodGlucoseLevel: 250 });
      const elevated = generateAttentionNavigator({ bloodGlucoseLevel: 160 });
      const normal = generateAttentionNavigator({ bloodGlucoseLevel: 100 });

      const findGlucose = (r: ReturnType<typeof generateAttentionNavigator>) =>
        r.priorities.find((p) => p.factor === "Blood Glucose");

      expect(findGlucose(critical)?.priority).toBe("high");
      expect(findGlucose(elevated)?.priority).toBe("moderate");
      expect(findGlucose(normal)?.priority).toBe("monitor");
    });

    it("returns moderate BMI priority for obese", () => {
      const obese = generateAttentionNavigator({ bmi: 32 });
      const overweight = generateAttentionNavigator({ bmi: 27 });
      const normal = generateAttentionNavigator({ bmi: 22 });

      const findBMI = (r: ReturnType<typeof generateAttentionNavigator>) =>
        r.priorities.find((p) => p.factor === "BMI");

      expect(findBMI(obese)?.priority).toBe("moderate");
      expect(findBMI(overweight)?.priority).toBe("monitor");
      expect(findBMI(normal)?.priority).toBe("monitor");
    });

    it("flags hypertension when present", () => {
      const withHypertension = generateAttentionNavigator({ hypertension: true });
      const without = generateAttentionNavigator({ hypertension: false });
      const htEntry = withHypertension.priorities.find((p) => p.factor === "Hypertension");
      const noHtEntry = without.priorities.find((p) => p.factor === "Hypertension");
      expect(htEntry?.priority).toBe("moderate");
      expect(noHtEntry).toBeUndefined();
    });

    it("flags heart disease as high priority", () => {
      const result = generateAttentionNavigator({ heartDisease: true });
      const hdEntry = result.priorities.find((p) => p.factor === "Heart Disease");
      expect(hdEntry?.priority).toBe("high");
    });

    it("flags current smoking as moderate priority", () => {
      const result = generateAttentionNavigator({ smokingHistory: "current smoker" });
      const smEntry = result.priorities.find((p) => p.factor === "Smoking History");
      expect(smEntry?.priority).toBe("moderate");
    });

    it("flags former smoking as monitor priority", () => {
      const result = generateAttentionNavigator({ smokingHistory: "former smoker" });
      const smEntry = result.priorities.find((p) => p.factor === "Smoking History");
      expect(smEntry?.priority).toBe("monitor");
    });

    it("handles null/undefined smoking gracefully", () => {
      const result = generateAttentionNavigator({ smokingHistory: undefined });
      expect(result.priorities).toBeDefined();
    });

    it("handles all-null assessment fields gracefully", () => {
      const result = generateAttentionNavigator({
        age: null,
        bmi: null,
        hba1cLevel: null,
        bloodGlucoseLevel: null,
        hypertension: undefined,
        heartDisease: undefined,
      });
      expect(result).toBeDefined();
      expect(Array.isArray(result.priorities)).toBe(true);
    });

    it("handles factors array with positive impact as high priority", () => {
      const result = generateAttentionNavigator({
        factors: [
          { name: "diabetic hba1c range", impact: "positive", description: "HbA1c elevated" },
        ],
      });
      const factorEntry = result.priorities.find(
        (p) => p.factor === "diabetic hba1c range",
      );
      expect(factorEntry?.priority).toBe("high");
    });

    it("handles factors array with negative impact as monitor priority", () => {
      const result = generateAttentionNavigator({
        factors: [
          { name: "stable profile", impact: "negative", description: "Stable" },
        ],
      });
      const factorEntry = result.priorities.find((p) => p.factor === "stable profile");
      expect(factorEntry?.priority).toBe("monitor");
    });

    it("limits factor-based priorities to 3 items", () => {
      const result = generateAttentionNavigator({
        factors: [
          { name: "Factor 1", impact: "positive", description: "A" },
          { name: "Factor 2", impact: "positive", description: "B" },
          { name: "Factor 3", impact: "positive", description: "C" },
          { name: "Factor 4", impact: "positive", description: "D" },
          { name: "Factor 5", impact: "positive", description: "E" },
        ],
      });
      const factorPriorities = result.priorities.filter(
        (p) => ["Factor 1", "Factor 2", "Factor 3", "Factor 4", "Factor 5"].includes(p.factor),
      );
      expect(factorPriorities.length).toBeLessThanOrEqual(3);
    });

    it("deduplicates factors by name (case-insensitive)", () => {
      const result = generateAttentionNavigator({
        hba1cLevel: 10,
        factors: [{ name: "HbA1c", impact: "positive", description: "A" }],
      });
      const hba1cEntries = result.priorities.filter((p) =>
        p.factor.toLowerCase().includes("hba1c"),
      );
      // Should not have duplicate HbA1c entries
      expect(hba1cEntries.length).toBeLessThanOrEqual(1);
    });

    it("promotes factor to high priority if another duplicate is high", () => {
      const result = generateAttentionNavigator({
        heartDisease: true,
        factors: [{ name: "Heart Disease", impact: "positive", description: "Heart disease" }],
      });
      const hdEntries = result.priorities.filter(
        (p) => p.factor.toLowerCase() === "heart disease",
      );
      // Both heartDisease and the named factor — should deduplicate to high
      const hdPriorities = hdEntries.map((e) => e.priority);
      expect(hdPriorities).toContain("high");
    });

    it("sorts priorities with high first, then moderate, then monitor", () => {
      const result = generateAttentionNavigator({
        riskCategory: "HIGH",
        hba1cLevel: 10,
        bloodGlucoseLevel: 250,
        bmi: 32,
        hypertension: true,
        heartDisease: true,
        smokingHistory: "current",
      });

      const priorities = result.priorities.map((p) => p.priority);
      const highCount = priorities.filter((p) => p === "high").length;
      const moderateCount = priorities.filter((p) => p === "moderate").length;
      const monitorCount = priorities.filter((p) => p === "monitor").length;

      // All high come before any moderate
      const firstModerate = priorities.indexOf("moderate");
      const lastHigh = priorities.lastIndexOf("high");
      if (firstModerate !== -1 && lastHigh !== -1) {
        expect(lastHigh).toBeLessThan(firstModerate);
      }
      // All moderate come before any monitor
      const firstMonitor = priorities.indexOf("monitor");
      const lastModerate = priorities.lastIndexOf("moderate");
      if (firstMonitor !== -1 && lastModerate !== -1) {
        expect(lastModerate).toBeLessThan(firstMonitor);
      }
    });
  });
});
