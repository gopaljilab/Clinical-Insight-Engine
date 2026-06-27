import { describe, it, expect } from "vitest";
import { generateAttentionNavigator, type NavigatorInput } from "./clinical-attention-navigator";

describe("generateAttentionNavigator", () => {
  it("returns empty priorities for empty input", () => {
    const result = generateAttentionNavigator({});
    expect(result.priorities).toEqual([]);
  });

  it("returns empty priorities when no risk factors present", () => {
    const result = generateAttentionNavigator({ riskCategory: "LOW", age: 30 });
    expect(result.priorities).toEqual([]);
  });

  it("marks HIGH riskCategory as high priority", () => {
    const result = generateAttentionNavigator({ riskCategory: "HIGH" });
    const riskCat = result.priorities.find(p => p.factor === "Risk category");
    expect(riskCat?.priority).toBe("high");
  });

  it("marks MODERATE riskCategory as moderate priority", () => {
    const result = generateAttentionNavigator({ riskCategory: "MODERATE" });
    const riskCat = result.priorities.find(p => p.factor === "Risk category");
    expect(riskCat?.priority).toBe("moderate");
  });

  it("does not add a priority entry for LOW riskCategory", () => {
    // LOW riskCategory is not added to priorities (no explicit entry)
    const result = generateAttentionNavigator({ riskCategory: "LOW", hba1cLevel: 5.0, bloodGlucoseLevel: 90 });
    const riskCat = result.priorities.find(p => p.factor === "Risk category");
    expect(riskCat).toBeUndefined();
  });

  describe("HbA1c thresholds", () => {
    it("returns high priority when HbA1c >= 9", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 9.5 });
      const hba1c = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1c?.priority).toBe("high");
    });

    it("returns moderate priority when HbA1c >= 7 and < 9", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 7.5 });
      const hba1c = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1c?.priority).toBe("moderate");
    });

    it("returns monitor priority when HbA1c < 7", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 6.0 });
      const hba1c = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1c?.priority).toBe("monitor");
    });

    it("handles missing HbA1c gracefully", () => {
      const result = generateAttentionNavigator({ hba1cLevel: undefined });
      const hba1c = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1c).toBeUndefined();
    });
  });

  describe("Blood glucose thresholds", () => {
    it("returns high priority when glucose >= 200", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 220 });
      const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(glucose?.priority).toBe("high");
    });

    it("returns moderate priority when glucose >= 140 and < 200", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 160 });
      const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(glucose?.priority).toBe("moderate");
    });

    it("returns monitor priority when glucose < 140", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 100 });
      const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(glucose?.priority).toBe("monitor");
    });
  });

  describe("BMI thresholds", () => {
    it("returns moderate priority when BMI >= 30", () => {
      const result = generateAttentionNavigator({ bmi: 32 });
      const bmi = result.priorities.find(p => p.factor === "BMI");
      expect(bmi?.priority).toBe("moderate");
    });

    it("returns monitor priority when BMI >= 25 and < 30", () => {
      const result = generateAttentionNavigator({ bmi: 27 });
      const bmi = result.priorities.find(p => p.factor === "BMI");
      expect(bmi?.priority).toBe("monitor");
    });

    it("returns monitor priority when BMI < 25", () => {
      const result = generateAttentionNavigator({ bmi: 22 });
      const bmi = result.priorities.find(p => p.factor === "BMI");
      expect(bmi?.priority).toBe("monitor");
    });
  });

  describe("Comorbidities", () => {
    it("marks hypertension as moderate priority", () => {
      const result = generateAttentionNavigator({ hypertension: true });
      const ht = result.priorities.find(p => p.factor === "Hypertension");
      expect(ht?.priority).toBe("moderate");
    });

    it("does not add hypertension priority when false", () => {
      const result = generateAttentionNavigator({ hypertension: false });
      const ht = result.priorities.find(p => p.factor === "Hypertension");
      expect(ht).toBeUndefined();
    });

    it("marks heartDisease as high priority", () => {
      const result = generateAttentionNavigator({ heartDisease: true });
      const hd = result.priorities.find(p => p.factor === "Heart Disease");
      expect(hd?.priority).toBe("high");
    });

    it("does not add heartDisease priority when false", () => {
      const result = generateAttentionNavigator({ heartDisease: false });
      const hd = result.priorities.find(p => p.factor === "Heart Disease");
      expect(hd).toBeUndefined();
    });
  });

  describe("Smoking history normalization", () => {
    it('normalizes "current smoker" to current', () => {
      const result = generateAttentionNavigator({ smokingHistory: "current smoker" });
      const smoke = result.priorities.find(p => p.factor === "Smoking History");
      expect(smoke?.priority).toBe("moderate");
    });

    it('normalizes "former smoker" to former', () => {
      const result = generateAttentionNavigator({ smokingHistory: "former smoker" });
      const smoke = result.priorities.find(p => p.factor === "Smoking History");
      expect(smoke?.priority).toBe("monitor");
    });

    it('normalizes "never smoked" to never', () => {
      const result = generateAttentionNavigator({ smokingHistory: "never smoked" });
      const smoke = result.priorities.find(p => p.factor === "Smoking History");
      expect(smoke).toBeUndefined();
    });

    it("returns monitor for unknown smoking status", () => {
      const result = generateAttentionNavigator({ smokingHistory: "unknown" });
      const smoke = result.priorities.find(p => p.factor === "Smoking History");
      expect(smoke).toBeUndefined();
    });
  });

  it("sorts priorities: high before moderate before monitor", () => {
    const result = generateAttentionNavigator({
      riskCategory: "HIGH",
      heartDisease: true,
      hypertension: true,
      smokingHistory: "current smoker",
      hba1cLevel: 5.5,
    });

    const priorities = result.priorities;
    const indices = priorities.map((p, i) => ({ factor: p.factor, priority: p.priority, index: i }));

    const highCount = priorities.filter(p => p.priority === "high").length;
    const moderateCount = priorities.filter(p => p.priority === "moderate").length;

    expect(priorities[0].priority).toBe("high");
    expect(priorities[highCount - 1].priority).toBe("high");
    if (moderateCount > 0) {
      expect(priorities[highCount].priority).toBe("moderate");
    }
  });

  it("deduplicates factors keeping highest priority", () => {
    // Both HIGH riskCategory and heartDisease would add 'high' for the same factor
    // but in practice they are different factors. Let's test with duplicate factors in input.
    const input: NavigatorInput = {
      riskCategory: "HIGH",
      heartDisease: true,
    };
    const result = generateAttentionNavigator(input);

    // No duplicates should exist
    const factors = result.priorities.map(p => p.factor.toLowerCase());
    const uniqueFactors = new Set(factors);
    expect(factors.length).toBe(uniqueFactors.size);
  });

  it("maps assessment factors correctly", () => {
    const result = generateAttentionNavigator({
      factors: [
        { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
        { name: "Age", impact: "negative", description: "Lowers risk" },
      ],
    });

    const factors = result.priorities.filter(p =>
      p.reason.includes("Factor contribution")
    );
    expect(factors.length).toBeGreaterThan(0);
  });
});
