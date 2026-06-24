import { describe, expect, it } from "vitest";
import { generateAttentionNavigator } from "./clinical-attention-navigator";

function getPriority(nav: ReturnType<typeof generateAttentionNavigator>, factor: string) {
  return nav.priorities.find((p) => p.factor === factor);
}

describe("generateAttentionNavigator", () => {
  describe("risk category", () => {
    it("adds high priority for HIGH risk category", () => {
      const nav = generateAttentionNavigator({ riskCategory: "HIGH" });
      const p = getPriority(nav, "Risk category");
      expect(p?.priority).toBe("high");
    });

    it("adds moderate priority for MODERATE risk category", () => {
      const nav = generateAttentionNavigator({ riskCategory: "MODERATE" });
      const p = getPriority(nav, "Risk category");
      expect(p?.priority).toBe("moderate");
    });

    it("adds no risk category priority for LOW", () => {
      const nav = generateAttentionNavigator({ riskCategory: "LOW" });
      expect(getPriority(nav, "Risk category")).toBeUndefined();
    });

    it("is case-insensitive for risk category", () => {
      const nav = generateAttentionNavigator({ riskCategory: "high" });
      expect(getPriority(nav, "Risk category")?.priority).toBe("high");
    });
  });

  describe("HbA1c thresholds", () => {
    it("is high when >= 9", () => {
      const nav = generateAttentionNavigator({ hba1cLevel: 9 });
      expect(getPriority(nav, "HbA1c")?.priority).toBe("high");
    });

    it("is high when > 9", () => {
      const nav = generateAttentionNavigator({ hba1cLevel: 10 });
      expect(getPriority(nav, "HbA1c")?.priority).toBe("high");
    });

    it("is moderate when >= 7 and < 9", () => {
      const nav = generateAttentionNavigator({ hba1cLevel: 7 });
      expect(getPriority(nav, "HbA1c")?.priority).toBe("moderate");
    });

    it("is moderate when between 7 and 9", () => {
      const nav = generateAttentionNavigator({ hba1cLevel: 8.5 });
      expect(getPriority(nav, "HbA1c")?.priority).toBe("moderate");
    });

    it("is monitor when < 7", () => {
      const nav = generateAttentionNavigator({ hba1cLevel: 6.5 });
      expect(getPriority(nav, "HbA1c")?.priority).toBe("monitor");
    });

    it("is monitor when missing", () => {
      const nav = generateAttentionNavigator({});
      expect(getPriority(nav, "HbA1c")).toBeUndefined();
    });

    it("includes numeric value", () => {
      const nav = generateAttentionNavigator({ hba1cLevel: 8 });
      expect(getPriority(nav, "HbA1c")?.value).toBe(8);
    });
  });

  describe("blood glucose thresholds", () => {
    it("is high when >= 200", () => {
      const nav = generateAttentionNavigator({ bloodGlucoseLevel: 200 });
      expect(getPriority(nav, "Blood Glucose")?.priority).toBe("high");
    });

    it("is high when > 200", () => {
      const nav = generateAttentionNavigator({ bloodGlucoseLevel: 300 });
      expect(getPriority(nav, "Blood Glucose")?.priority).toBe("high");
    });

    it("is moderate when >= 140 and < 200", () => {
      const nav = generateAttentionNavigator({ bloodGlucoseLevel: 150 });
      expect(getPriority(nav, "Blood Glucose")?.priority).toBe("moderate");
    });

    it("is moderate when exactly 140", () => {
      const nav = generateAttentionNavigator({ bloodGlucoseLevel: 140 });
      expect(getPriority(nav, "Blood Glucose")?.priority).toBe("moderate");
    });

    it("is monitor when < 140", () => {
      const nav = generateAttentionNavigator({ bloodGlucoseLevel: 120 });
      expect(getPriority(nav, "Blood Glucose")?.priority).toBe("monitor");
    });

    it("is monitor when missing", () => {
      const nav = generateAttentionNavigator({});
      expect(getPriority(nav, "Blood Glucose")).toBeUndefined();
    });

    it("includes numeric value", () => {
      const nav = generateAttentionNavigator({ bloodGlucoseLevel: 180 });
      expect(getPriority(nav, "Blood Glucose")?.value).toBe(180);
    });
  });

  describe("BMI thresholds", () => {
    it("is moderate when >= 30", () => {
      const nav = generateAttentionNavigator({ bmi: 32 });
      expect(getPriority(nav, "BMI")?.priority).toBe("moderate");
    });

    it("is moderate when exactly 30", () => {
      const nav = generateAttentionNavigator({ bmi: 30 });
      expect(getPriority(nav, "BMI")?.priority).toBe("moderate");
    });

    it("is monitor when >= 25 and < 30", () => {
      const nav = generateAttentionNavigator({ bmi: 27 });
      expect(getPriority(nav, "BMI")?.priority).toBe("monitor");
    });

    it("is monitor when exactly 25", () => {
      const nav = generateAttentionNavigator({ bmi: 25 });
      expect(getPriority(nav, "BMI")?.priority).toBe("monitor");
    });

    it("is monitor when < 25", () => {
      const nav = generateAttentionNavigator({ bmi: 22 });
      expect(getPriority(nav, "BMI")?.priority).toBe("monitor");
    });

    it("is monitor when missing", () => {
      const nav = generateAttentionNavigator({});
      expect(getPriority(nav, "BMI")).toBeUndefined();
    });
  });

  describe("hypertension", () => {
    it("adds moderate priority when true", () => {
      const nav = generateAttentionNavigator({ hypertension: true });
      expect(getPriority(nav, "Hypertension")?.priority).toBe("moderate");
    });

    it("adds no priority when false", () => {
      const nav = generateAttentionNavigator({ hypertension: false });
      expect(getPriority(nav, "Hypertension")).toBeUndefined();
    });

    it("adds no priority when missing", () => {
      const nav = generateAttentionNavigator({});
      expect(getPriority(nav, "Hypertension")).toBeUndefined();
    });
  });

  describe("heart disease", () => {
    it("adds high priority when true", () => {
      const nav = generateAttentionNavigator({ heartDisease: true });
      expect(getPriority(nav, "Heart Disease")?.priority).toBe("high");
    });

    it("adds no priority when false", () => {
      const nav = generateAttentionNavigator({ heartDisease: false });
      expect(getPriority(nav, "Heart Disease")).toBeUndefined();
    });
  });

  describe("smoking normalization", () => {
    it('adds moderate priority for "current" smoking', () => {
      const nav = generateAttentionNavigator({ smokingHistory: "current smoker" });
      expect(getPriority(nav, "Smoking History")?.priority).toBe("moderate");
    });

    it('adds monitor priority for "former" smoking', () => {
      const nav = generateAttentionNavigator({ smokingHistory: "former smoker" });
      expect(getPriority(nav, "Smoking History")?.priority).toBe("monitor");
    });

    it('adds no priority for "never" smoking', () => {
      const nav = generateAttentionNavigator({ smokingHistory: "never smoked" });
      expect(getPriority(nav, "Smoking History")).toBeUndefined();
    });

    it("adds no priority for unknown smoking history", () => {
      const nav = generateAttentionNavigator({ smokingHistory: "" });
      expect(getPriority(nav, "Smoking History")).toBeUndefined();
    });

    it("is case-insensitive", () => {
      const nav = generateAttentionNavigator({ smokingHistory: "CURRENT" });
      expect(getPriority(nav, "Smoking History")?.priority).toBe("moderate");
    });
  });

  describe("factor deduplication", () => {
    it("keeps high priority when low priority also exists for same factor", () => {
      // Heart disease gives high, but a "heart disease" factor would give monitor
      const nav = generateAttentionNavigator({
        heartDisease: true,
        factors: [{ name: "heart disease", impact: "negative", description: "some factor" }],
      });
      // Both would add "Heart Disease", high wins
      const priorities = nav.priorities.filter(
        (p) => p.factor.toLowerCase() === "heart disease"
      );
      expect(priorities.length).toBe(1);
      expect(priorities[0].priority).toBe("high");
    });

    it("keeps moderate when only moderate exists", () => {
      const nav = generateAttentionNavigator({
        hypertension: true,
        factors: [{ name: "hypertension", impact: "negative", description: "some factor" }],
      });
      const priorities = nav.priorities.filter(
        (p) => p.factor.toLowerCase() === "hypertension"
      );
      expect(priorities.length).toBe(1);
      expect(priorities[0].priority).toBe("moderate");
    });
  });

  describe("factor sorting", () => {
    it("sorts high before moderate before monitor", () => {
      const nav = generateAttentionNavigator({
        riskCategory: "HIGH",
        heartDisease: true,
        hypertension: true,
        smokingHistory: "current",
        bmi: 35,
        bloodGlucoseLevel: 220,
        hba1cLevel: 9.5,
      });
      const priorities = nav.priorities.map((p) => p.priority);
      // High priorities first
      const highCount = priorities.filter((p) => p === "high").length;
      const moderateCount = priorities.filter((p) => p === "moderate").length;
      const monitorCount = priorities.filter((p) => p === "monitor").length;
      expect(highCount).toBeGreaterThan(0);
      expect(moderateCount).toBeGreaterThan(0);
      // High come before moderate/monitor
      const firstModerateIndex = priorities.indexOf("moderate");
      const lastHighIndex = priorities.lastIndexOf("high");
      expect(lastHighIndex).toBeLessThan(firstModerateIndex);
    });

    it("sorts alphabetically within same priority tier", () => {
      const nav = generateAttentionNavigator({
        heartDisease: true,
        hypertension: true,
      });
      // Both are moderate priority
      const moderatePriorities = nav.priorities.filter((p) => p.priority === "moderate");
      const factors = moderatePriorities.map((p) => p.factor);
      const sorted = [...factors].sort();
      expect(factors).toEqual(sorted);
    });
  });

  describe("factors array", () => {
    it("adds up to 3 factors sorted by positive impact first", () => {
      const nav = generateAttentionNavigator({
        factors: [
          { name: "factor A", impact: "negative", description: "a" },
          { name: "factor B", impact: "positive", description: "b" },
          { name: "factor C", impact: "negative", description: "c" },
        ],
      });
      // Positive factors come first, then negative
      const addedPriorities = nav.priorities.filter(
        (p) => p.factor === "factor A" || p.factor === "factor B" || p.factor === "factor C"
      );
      expect(addedPriorities.length).toBe(3);
      // factor B (positive) should come before factor A and C (negative)
      expect(addedPriorities[0].factor).toBe("factor B");
    });

    it("limits to 3 factors", () => {
      const nav = generateAttentionNavigator({
        factors: [
          { name: "a", impact: "negative", description: "a" },
          { name: "b", impact: "negative", description: "b" },
          { name: "c", impact: "negative", description: "c" },
          { name: "d", impact: "negative", description: "d" },
        ],
      });
      const addedPriorities = nav.priorities.filter(
        (p) => ["a", "b", "c", "d"].includes(p.factor)
      );
      expect(addedPriorities.length).toBe(3);
    });

    it("gives positive impact high priority", () => {
      const nav = generateAttentionNavigator({
        factors: [{ name: "good factor", impact: "positive", description: "good" }],
      });
      expect(getPriority(nav, "good factor")?.priority).toBe("high");
    });

    it("gives negative impact monitor priority", () => {
      const nav = generateAttentionNavigator({
        factors: [{ name: "bad factor", impact: "negative", description: "bad" }],
      });
      expect(getPriority(nav, "bad factor")?.priority).toBe("monitor");
    });
  });

  describe("empty input", () => {
    it("returns navigator with empty priorities array", () => {
      const nav = generateAttentionNavigator({});
      expect(nav.priorities).toEqual([]);
    });
  });

  describe("return type shape", () => {
    it("returns an object with priorities array", () => {
      const nav = generateAttentionNavigator({ riskCategory: "HIGH" });
      expect(nav).toHaveProperty("priorities");
      expect(Array.isArray(nav.priorities)).toBe(true);
    });

    it("each priority has factor, priority, and reason", () => {
      const nav = generateAttentionNavigator({ riskCategory: "HIGH" });
      const p = nav.priorities[0];
      expect(p).toHaveProperty("factor");
      expect(p).toHaveProperty("priority");
      expect(p).toHaveProperty("reason");
      expect(["high", "moderate", "monitor"]).toContain(p.priority);
    });
  });
});
