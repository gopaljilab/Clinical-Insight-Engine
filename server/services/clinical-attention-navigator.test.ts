import { describe, expect, it } from "vitest";
import { generateAttentionNavigator } from "./clinical-attention-navigator";

describe("generateAttentionNavigator", () => {
  describe("risk category", () => {
    it("pushes high priority item when riskCategory is HIGH", () => {
      const result = generateAttentionNavigator({ riskCategory: "HIGH" });
      expect(result.priorities[0].factor).toBe("Risk category");
      expect(result.priorities[0].priority).toBe("high");
    });

    it("pushes moderate priority item when riskCategory is MODERATE", () => {
      const result = generateAttentionNavigator({ riskCategory: "MODERATE" });
      expect(result.priorities[0].factor).toBe("Risk category");
      expect(result.priorities[0].priority).toBe("moderate");
    });

    it("does not push risk category item for LOW", () => {
      const result = generateAttentionNavigator({ riskCategory: "LOW" });
      const rc = result.priorities.filter(p => p.factor === "Risk category");
      expect(rc.length).toBe(0);
    });
  });

  describe("HbA1c", () => {
    it("maps HbA1c >= 9 to high priority", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 9.5 });
      const item = result.priorities.find(p => p.factor === "HbA1c");
      expect(item?.priority).toBe("high");
      expect(item?.value).toBe(9.5);
    });

    it("maps HbA1c between 7 and 9 to moderate priority", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 7.5 });
      const item = result.priorities.find(p => p.factor === "HbA1c");
      expect(item?.priority).toBe("moderate");
    });

    it("maps HbA1c < 7 to monitor priority", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 5.8 });
      const item = result.priorities.find(p => p.factor === "HbA1c");
      expect(item?.priority).toBe("monitor");
    });

    it("skips HbA1c when not provided", () => {
      const result = generateAttentionNavigator({});
      const item = result.priorities.find(p => p.factor === "HbA1c");
      expect(item).toBeUndefined();
    });
  });

  describe("blood glucose", () => {
    it("maps glucose >= 200 to high priority", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 250 });
      const item = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(item?.priority).toBe("high");
    });

    it("maps glucose between 140 and 200 to moderate priority", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 160 });
      const item = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(item?.priority).toBe("moderate");
    });

    it("maps glucose < 140 to monitor priority", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 110 });
      const item = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(item?.priority).toBe("monitor");
    });
  });

  describe("BMI", () => {
    it("maps BMI >= 30 to moderate priority", () => {
      const result = generateAttentionNavigator({ bmi: 32 });
      const item = result.priorities.find(p => p.factor === "BMI");
      expect(item?.priority).toBe("moderate");
    });

    it("maps BMI between 25 and 30 to monitor priority", () => {
      const result = generateAttentionNavigator({ bmi: 27 });
      const item = result.priorities.find(p => p.factor === "BMI");
      expect(item?.priority).toBe("monitor");
    });

    it("maps BMI < 25 to monitor priority", () => {
      const result = generateAttentionNavigator({ bmi: 22 });
      const item = result.priorities.find(p => p.factor === "BMI");
      expect(item?.priority).toBe("monitor");
    });
  });

  describe("hypertension", () => {
    it("pushes moderate priority when hypertension is true", () => {
      const result = generateAttentionNavigator({ hypertension: true });
      const item = result.priorities.find(p => p.factor === "Hypertension");
      expect(item?.priority).toBe("moderate");
    });

    it("does not push item when hypertension is false", () => {
      const result = generateAttentionNavigator({ hypertension: false });
      const item = result.priorities.find(p => p.factor === "Hypertension");
      expect(item).toBeUndefined();
    });
  });

  describe("heart disease", () => {
    it("pushes high priority when heartDisease is true", () => {
      const result = generateAttentionNavigator({ heartDisease: true });
      const item = result.priorities.find(p => p.factor === "Heart Disease");
      expect(item?.priority).toBe("high");
    });

    it("does not push item when heartDisease is false", () => {
      const result = generateAttentionNavigator({ heartDisease: false });
      const item = result.priorities.find(p => p.factor === "Heart Disease");
      expect(item).toBeUndefined();
    });
  });

  describe("smoking history", () => {
    it("maps current smoking to moderate priority", () => {
      const result = generateAttentionNavigator({ smokingHistory: "current" });
      const item = result.priorities.find(p => p.factor === "Smoking History");
      expect(item?.priority).toBe("moderate");
    });

    it("maps former smoking to monitor priority", () => {
      const result = generateAttentionNavigator({ smokingHistory: "former" });
      const item = result.priorities.find(p => p.factor === "Smoking History");
      expect(item?.priority).toBe("monitor");
    });

    it("maps never smoking to no item", () => {
      const result = generateAttentionNavigator({ smokingHistory: "never" });
      const item = result.priorities.find(p => p.factor === "Smoking History");
      expect(item).toBeUndefined();
    });
  });

  describe("factors array", () => {
    it("adds top 3 factors sorted by impact", () => {
      const factors = [
        { name: "Factor A", description: "desc", impact: "positive" as const },
        { name: "Factor B", description: "desc", impact: "negative" as const },
        { name: "Factor C", description: "desc", impact: "positive" as const },
        { name: "Factor D", description: "desc", impact: "negative" as const },
      ];
      const result = generateAttentionNavigator({ factors });
      const labels = result.priorities.map(p => p.factor);
      expect(labels.filter(l => l === "Factor A" || l === "Factor C")).toHaveLength(2);
      expect(labels.filter(l => l === "Factor B" || l === "Factor D")).toHaveLength(1);
    });

    it("maps positive impact to high priority, negative to monitor", () => {
      const factors = [
        { name: "Positive Factor", description: "positive impact", impact: "positive" as const },
        { name: "Negative Factor", description: "negative impact", impact: "negative" as const },
      ];
      const result = generateAttentionNavigator({ factors });
      const pos = result.priorities.find(p => p.factor === "Positive Factor");
      const neg = result.priorities.find(p => p.factor === "Negative Factor");
      expect(pos?.priority).toBe("high");
      expect(neg?.priority).toBe("monitor");
    });
  });

  describe("deduplication", () => {
    it("keeps high-priority item over moderate when same factor name appears twice", () => {
      const result = generateAttentionNavigator({
        riskCategory: "HIGH",
        smokingHistory: "current",
        factors: [
          { name: "Risk category", description: "some factor", impact: "negative" as const },
        ],
      });
      const rcItems = result.priorities.filter(p => p.factor === "Risk category");
      expect(rcItems.length).toBe(1);
      expect(rcItems[0].priority).toBe("high");
    });
  });

  describe("sorting", () => {
    it("sorts priorities: high first, then moderate, then monitor", () => {
      const result = generateAttentionNavigator({
        riskCategory: "MODERATE",
        hba1cLevel: 9.5,
        bmi: 22,
        smokingHistory: "current",
      });
      const priorities = result.priorities.map(p => p.priority);
      const firstHigh = priorities.indexOf("high");
      const firstModerate = priorities.indexOf("moderate");
      const firstMonitor = priorities.indexOf("monitor");
      expect(firstHigh).toBeLessThan(firstModerate);
      expect(firstModerate).toBeLessThan(firstMonitor);
    });
  });

  describe("normalizeSmoking", () => {
    it("handles null/undefined input", () => {
      const result = generateAttentionNavigator({ smokingHistory: null as any });
      const item = result.priorities.find(p => p.factor === "Smoking History");
      expect(item).toBeUndefined();
    });

    it("handles empty string", () => {
      const result = generateAttentionNavigator({ smokingHistory: "" });
      const item = result.priorities.find(p => p.factor === "Smoking History");
      expect(item).toBeUndefined();
    });

    it("handles mixed-case input", () => {
      const result = generateAttentionNavigator({ smokingHistory: "CURRENT Smoker" });
      const item = result.priorities.find(p => p.factor === "Smoking History");
      expect(item?.priority).toBe("moderate");
    });
  });
});
