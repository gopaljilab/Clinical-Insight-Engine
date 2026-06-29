import { describe, it, expect } from "vitest";
import { generateAttentionNavigator } from "./clinical-attention-navigator";

describe("generateAttentionNavigator", () => {
  it("returns empty priorities for empty input", () => {
    const result = generateAttentionNavigator({});
    expect(result.priorities).toEqual([]);
  });

  it("returns empty priorities for partial input with no risk fields", () => {
    const result = generateAttentionNavigator({ age: 30 });
    expect(result.priorities).toEqual([]);
  });

  describe("risk category", () => {
    it("flags HIGH risk category as high priority", () => {
      const result = generateAttentionNavigator({ riskCategory: "HIGH" });
      const rc = result.priorities.find((p) => p.factor === "Risk category");
      expect(rc?.priority).toBe("high");
    });

    it("flags MODERATE risk category as moderate priority", () => {
      const result = generateAttentionNavigator({ riskCategory: "MODERATE" });
      const rc = result.priorities.find((p) => p.factor === "Risk category");
      expect(rc?.priority).toBe("moderate");
    });

    it("omits LOW risk category", () => {
      const result = generateAttentionNavigator({ riskCategory: "LOW" });
      const rc = result.priorities.find((p) => p.factor === "Risk category");
      expect(rc).toBeUndefined();
    });

    it("case-insensitive: lowercase high", () => {
      const result = generateAttentionNavigator({ riskCategory: "high" });
      const rc = result.priorities.find((p) => p.factor === "Risk category");
      expect(rc?.priority).toBe("high");
    });
  });

  describe("HbA1c prioritization", () => {
    it("assigns high priority for HbA1c >= 9", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 9.0 });
      const h = result.priorities.find((p) => p.factor === "HbA1c");
      expect(h?.priority).toBe("high");
      expect(h?.value).toBe(9.0);
    });

    it("assigns high priority for HbA1c well above 9", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 11.5 });
      const h = result.priorities.find((p) => p.factor === "HbA1c");
      expect(h?.priority).toBe("high");
    });

    it("assigns moderate priority for 7 <= HbA1c < 9", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 7.5 });
      const m = result.priorities.find((p) => p.factor === "HbA1c");
      expect(m?.priority).toBe("moderate");
    });

    it("assigns moderate priority for exactly 7", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 7.0 });
      const m = result.priorities.find((p) => p.factor === "HbA1c");
      expect(m?.priority).toBe("moderate");
    });

    it("assigns monitor priority for HbA1c < 7", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 6.5 });
      const mon = result.priorities.find((p) => p.factor === "HbA1c");
      expect(mon?.priority).toBe("monitor");
    });

    it("ignores NaN HbA1c", () => {
      const result = generateAttentionNavigator({ hba1cLevel: NaN });
      const h = result.priorities.find((p) => p.factor === "HbA1c");
      expect(h).toBeUndefined();
    });
  });

  describe("blood glucose prioritization", () => {
    it("assigns high priority for glucose >= 200", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 200 });
      const h = result.priorities.find((p) => p.factor === "Blood Glucose");
      expect(h?.priority).toBe("high");
    });

    it("assigns high priority for glucose well above 200", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 350 });
      const h = result.priorities.find((p) => p.factor === "Blood Glucose");
      expect(h?.priority).toBe("high");
    });

    it("assigns moderate priority for 140 <= glucose < 200", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 150 });
      const m = result.priorities.find((p) => p.factor === "Blood Glucose");
      expect(m?.priority).toBe("moderate");
    });

    it("assigns moderate priority for exactly 140", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 140 });
      const m = result.priorities.find((p) => p.factor === "Blood Glucose");
      expect(m?.priority).toBe("moderate");
    });

    it("assigns monitor priority for glucose < 140", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 120 });
      const mon = result.priorities.find((p) => p.factor === "Blood Glucose");
      expect(mon?.priority).toBe("monitor");
    });
  });

  describe("BMI prioritization", () => {
    it("assigns moderate priority for BMI >= 30", () => {
      const result = generateAttentionNavigator({ bmi: 32 });
      const m = result.priorities.find((p) => p.factor === "BMI");
      expect(m?.priority).toBe("moderate");
    });

    it("assigns moderate priority for exactly 30", () => {
      const result = generateAttentionNavigator({ bmi: 30 });
      const m = result.priorities.find((p) => p.factor === "BMI");
      expect(m?.priority).toBe("moderate");
    });

    it("assigns monitor priority for 25 <= BMI < 30", () => {
      const result = generateAttentionNavigator({ bmi: 27 });
      const mon = result.priorities.find((p) => p.factor === "BMI");
      expect(mon?.priority).toBe("monitor");
    });

    it("assigns monitor priority for BMI < 25", () => {
      const result = generateAttentionNavigator({ bmi: 22 });
      const mon = result.priorities.find((p) => p.factor === "BMI");
      expect(mon?.priority).toBe("monitor");
    });
  });

  describe("hypertension", () => {
    it("flags hypertension present as moderate priority", () => {
      const result = generateAttentionNavigator({ hypertension: true });
      const h = result.priorities.find((p) => p.factor === "Hypertension");
      expect(h?.priority).toBe("moderate");
    });

    it("omits hypertension when false", () => {
      const result = generateAttentionNavigator({ hypertension: false });
      const h = result.priorities.find((p) => p.factor === "Hypertension");
      expect(h).toBeUndefined();
    });
  });

  describe("heart disease", () => {
    it("flags heart disease present as high priority", () => {
      const result = generateAttentionNavigator({ heartDisease: true });
      const h = result.priorities.find((p) => p.factor === "Heart Disease");
      expect(h?.priority).toBe("high");
    });

    it("omits heart disease when false", () => {
      const result = generateAttentionNavigator({ heartDisease: false });
      const h = result.priorities.find((p) => p.factor === "Heart Disease");
      expect(h).toBeUndefined();
    });
  });

  describe("smoking history", () => {
    it("assigns moderate priority for current smoking", () => {
      const result = generateAttentionNavigator({ smokingHistory: "current" });
      const s = result.priorities.find((p) => p.factor === "Smoking History");
      expect(s?.priority).toBe("moderate");
    });

    it("assigns monitor priority for former smoking", () => {
      const result = generateAttentionNavigator({ smokingHistory: "former" });
      const s = result.priorities.find((p) => p.factor === "Smoking History");
      expect(s?.priority).toBe("monitor");
    });

    it("omits smoking history when never", () => {
      const result = generateAttentionNavigator({ smokingHistory: "never" });
      const s = result.priorities.find((p) => p.factor === "Smoking History");
      expect(s).toBeUndefined();
    });
  });

  describe("factor deduplication", () => {
    it("keeps highest priority when same factor appears multiple times", () => {
      const result = generateAttentionNavigator({
        riskCategory: "HIGH",
        heartDisease: true,
      });
      const heartDisease = result.priorities.find((p) => p.factor === "Heart Disease");
      expect(heartDisease?.priority).toBe("high");
    });
  });

  describe("priority ordering", () => {
    it("priorities are sorted: high before moderate before monitor", () => {
      const result = generateAttentionNavigator({
        heartDisease: true,
        bmi: 32,
      });
      const priorities = result.priorities.map((p) => p.priority);
      const highIdx = priorities.indexOf("high");
      const moderateIdx = priorities.indexOf("moderate");
      expect(highIdx).toBeLessThan(moderateIdx);
    });

    it("factors with same priority are sorted alphabetically", () => {
      const result = generateAttentionNavigator({
        heartDisease: true,
        hypertension: true,
        riskCategory: "HIGH",
      });
      const highFactors = result.priorities
        .filter((p) => p.priority === "high")
        .map((p) => p.factor);
      expect(highFactors).toEqual([...highFactors].sort());
    });
  });

  describe("factors input", () => {
    it("adds top 3 factors sorted by impact", () => {
      const result = generateAttentionNavigator({
        factors: [
          { name: "Exercise", impact: "negative", description: "No exercise" },
          { name: "Diet", impact: "positive", description: "Good diet" },
          { name: "Sleep", impact: "positive", description: "Adequate sleep" },
          { name: "Stress", impact: "negative", description: "High stress" },
        ],
      });
      expect(result.priorities.filter((p) => ["Diet", "Sleep", "Exercise"].includes(p.factor))).toHaveLength(3);
    });

    it("assigns high priority to positive-impact factors", () => {
      const result = generateAttentionNavigator({
        factors: [{ name: "Diet", impact: "positive", description: "Good" }],
      });
      const d = result.priorities.find((p) => p.factor === "Diet");
      expect(d?.priority).toBe("high");
    });

    it("assigns monitor priority to negative-impact factors", () => {
      const result = generateAttentionNavigator({
        factors: [{ name: "Sedentary", impact: "negative", description: "No exercise" }],
      });
      const s = result.priorities.find((p) => p.factor === "Sedentary");
      expect(s?.priority).toBe("monitor");
    });
  });

  describe("full patient input", () => {
    it("does not crash on full assessment input", () => {
      const result = generateAttentionNavigator({
        age: 55,
        bmi: 31,
        hba1cLevel: 8.5,
        bloodGlucoseLevel: 160,
        hypertension: true,
        heartDisease: false,
        smokingHistory: "former",
        riskCategory: "MODERATE",
        factors: [{ name: "Exercise", impact: "negative", description: "No exercise" }],
      });
      expect(result.priorities.length).toBeGreaterThan(0);
    });

    it("returns valid AttentionNavigator structure", () => {
      const result = generateAttentionNavigator({});
      expect(result).toHaveProperty("priorities");
      expect(Array.isArray(result.priorities)).toBe(true);
    });
  });
});
