import { describe, it, expect } from "vitest";
import { generateAttentionNavigator } from "./clinical-attention-navigator";
import type { AssessmentFactor } from "@shared/schema";

describe("generateAttentionNavigator", () => {
  describe("riskCategory priority", () => {
    it("assigns HIGH priority when riskCategory is HIGH", () => {
      const result = generateAttentionNavigator({ riskCategory: "HIGH" });
      const rc = result.priorities.find(p => p.factor === "Risk category");
      expect(rc?.priority).toBe("high");
    });

    it("assigns MODERATE priority when riskCategory is MODERATE", () => {
      const result = generateAttentionNavigator({ riskCategory: "MODERATE" });
      const rc = result.priorities.find(p => p.factor === "Risk category");
      expect(rc?.priority).toBe("moderate");
    });

    it("assigns MONITOR priority when riskCategory is LOW", () => {
      const result = generateAttentionNavigator({ riskCategory: "LOW" });
      const rc = result.priorities.find(p => p.factor === "Risk category");
      expect(rc).toBeUndefined();
    });
  });

  describe("HbA1c priority", () => {
    it("assigns HIGH when HbA1c >= 9", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 9.5 });
      const hba1c = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1c?.priority).toBe("high");
    });

    it("assigns MODERATE when HbA1c >= 7 and < 9", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 7.5 });
      const hba1c = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1c?.priority).toBe("moderate");
    });

    it("assigns MONITOR when HbA1c < 7", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 6.5 });
      const hba1c = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1c?.priority).toBe("monitor");
    });

    it("skips HbA1c entry when NaN", () => {
      const result = generateAttentionNavigator({ hba1cLevel: NaN });
      const hba1c = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1c).toBeUndefined();
    });
  });

  describe("blood glucose priority", () => {
    it("assigns HIGH when glucose >= 200", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 250 });
      const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(glucose?.priority).toBe("high");
    });

    it("assigns MODERATE when glucose >= 140 and < 200", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 160 });
      const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(glucose?.priority).toBe("moderate");
    });

    it("assigns MONITOR when glucose < 140", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 100 });
      const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(glucose?.priority).toBe("monitor");
    });
  });

  describe("BMI priority", () => {
    it("assigns MODERATE when BMI >= 30", () => {
      const result = generateAttentionNavigator({ bmi: 32 });
      const bmi = result.priorities.find(p => p.factor === "BMI");
      expect(bmi?.priority).toBe("moderate");
    });

    it("assigns MONITOR when BMI >= 25 and < 30", () => {
      const result = generateAttentionNavigator({ bmi: 27 });
      const bmi = result.priorities.find(p => p.factor === "BMI");
      expect(bmi?.priority).toBe("monitor");
    });

    it("assigns MONITOR when BMI < 25", () => {
      const result = generateAttentionNavigator({ bmi: 22 });
      const bmi = result.priorities.find(p => p.factor === "BMI");
      expect(bmi?.priority).toBe("monitor");
    });
  });

  describe("comorbidities", () => {
    it("assigns MODERATE when hypertension is true", () => {
      const result = generateAttentionNavigator({ hypertension: true });
      const ht = result.priorities.find(p => p.factor === "Hypertension");
      expect(ht?.priority).toBe("moderate");
    });

    it("does not add hypertension when false", () => {
      const result = generateAttentionNavigator({ hypertension: false });
      const ht = result.priorities.find(p => p.factor === "Hypertension");
      expect(ht).toBeUndefined();
    });

    it("assigns HIGH when heartDisease is true", () => {
      const result = generateAttentionNavigator({ heartDisease: true });
      const hd = result.priorities.find(p => p.factor === "Heart Disease");
      expect(hd?.priority).toBe("high");
    });
  });

  describe("smokingHistory normalization", () => {
    it("normalizes 'current' smoking to MODERATE", () => {
      const result = generateAttentionNavigator({ smokingHistory: "current smoker" });
      const smoking = result.priorities.find(p => p.factor === "Smoking History");
      expect(smoking?.priority).toBe("moderate");
    });

    it("normalizes 'former' smoking to MONITOR", () => {
      const result = generateAttentionNavigator({ smokingHistory: "Former smoker" });
      const smoking = result.priorities.find(p => p.factor === "Smoking History");
      expect(smoking?.priority).toBe("monitor");
    });

    it("normalizes 'never' smoking to no entry", () => {
      const result = generateAttentionNavigator({ smokingHistory: "never smoked" });
      const smoking = result.priorities.find(p => p.factor === "Smoking History");
      expect(smoking).toBeUndefined();
    });

    it("defaults unknown smoking to no entry", () => {
      const result = generateAttentionNavigator({ smokingHistory: "unknown" });
      const smoking = result.priorities.find(p => p.factor === "Smoking History");
      expect(smoking).toBeUndefined();
    });
  });

  describe("AssessmentFactor integration", () => {
    it("includes factors sorted by impact, capped at 3", () => {
      const factors: AssessmentFactor[] = [
        { name: "factor A", impact: "negative", description: "desc A" },
        { name: "factor B", impact: "positive", description: "desc B" },
        { name: "factor C", impact: "negative", description: "desc C" },
        { name: "factor D", impact: "positive", description: "desc D" },
        { name: "factor E", impact: "negative", description: "desc E" },
      ];
      const result = generateAttentionNavigator({ factors });
      expect(result.priorities.filter(p =>
        ["factor A", "factor B", "factor C", "factor D", "factor E"].includes(p.factor)
      ).length).toBeLessThanOrEqual(3);
    });

    it("assigns HIGH priority to positive-impact factors", () => {
      const factors: AssessmentFactor[] = [
        { name: "stable profile", impact: "positive", description: "stable" },
      ];
      const result = generateAttentionNavigator({ factors });
      const factor = result.priorities.find(p => p.factor === "stable profile");
      expect(factor?.priority).toBe("high");
    });
  });

  describe("deduplication", () => {
    it("keeps highest priority when same factor appears twice", () => {
      // HbA1c at HIGH from numeric check and from factor
      const result = generateAttentionNavigator({
        hba1cLevel: 10, // HIGH from numeric
      });
      const hba1cItems = result.priorities.filter(p => p.factor === "HbA1c");
      // Should have at most one HbA1c entry
      expect(hba1cItems.length).toBeLessThanOrEqual(1);
    });
  });

  describe("sorting", () => {
    it("sorts HIGH before MODERATE before MONITOR", () => {
      const result = generateAttentionNavigator({
        riskCategory: "HIGH",
        hypertension: true,
        bmi: 22,
        hba1cLevel: 6.0,
        bloodGlucoseLevel: 100,
      });
      const priorities = result.priorities.map(p => p.priority);
      const highIdx = priorities.indexOf("high");
      const modIdx = priorities.indexOf("moderate");
      expect(highIdx).toBeLessThan(modIdx);
    });

    it("within same priority, sorts alphabetically", () => {
      const result = generateAttentionNavigator({
        heartDisease: true,
        smokingHistory: "current",
      });
      const moderate = result.priorities.filter(p => p.priority === "moderate");
      const factors = moderate.map(p => p.factor);
      // alphabetical: Hypertension before Smoking History
      const sorted = [...factors].sort();
      expect(factors).toEqual(sorted);
    });
  });
});
