import { describe, expect, it } from "vitest";
import { generateAttentionNavigator } from "./clinical-attention-navigator";

describe("generateAttentionNavigator", () => {
  describe("riskCategory factor", () => {
    it("adds a HIGH priority risk-category factor for HIGH riskCategory", () => {
      const result = generateAttentionNavigator({ riskCategory: "HIGH" });
      const rc = result.priorities.find(p => p.factor === "Risk category");
      expect(rc?.priority).toBe("high");
      expect(rc?.reason).toContain("urgent clinician attention");
    });

    it("adds a MODERATE priority risk-category factor for MODERATE riskCategory", () => {
      const result = generateAttentionNavigator({ riskCategory: "MODERATE" });
      const rc = result.priorities.find(p => p.factor === "Risk category");
      expect(rc?.priority).toBe("moderate");
      expect(rc?.reason).toContain("active monitoring");
    });

    it("does not add a risk-category factor for LOW riskCategory", () => {
      const result = generateAttentionNavigator({ riskCategory: "LOW" });
      const rc = result.priorities.find(p => p.factor === "Risk category");
      expect(rc).toBeUndefined();
    });

    it("treats absent riskCategory as LOW", () => {
      const result = generateAttentionNavigator({});
      const rc = result.priorities.find(p => p.factor === "Risk category");
      expect(rc).toBeUndefined();
    });
  });

  describe("HbA1c factor", () => {
    it("assigns HIGH priority for HbA1c >= 9", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 10.5 });
      const hba = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba?.priority).toBe("high");
      expect(hba?.value).toBe(10.5);
    });

    it("assigns MODERATE priority for HbA1c >= 7 and < 9", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 7.5 });
      const hba = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba?.priority).toBe("moderate");
    });

    it("assigns MONITOR priority for HbA1c < 7", () => {
      const result = generateAttentionNavigator({ hba1cLevel: 5.8 });
      const hba = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba?.priority).toBe("monitor");
    });

    it("skips HbA1c factor when undefined", () => {
      const result = generateAttentionNavigator({});
      const hba = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba).toBeUndefined();
    });
  });

  describe("blood glucose factor", () => {
    it("assigns HIGH priority for blood glucose >= 200", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 250 });
      const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(glucose?.priority).toBe("high");
      expect(glucose?.value).toBe(250);
    });

    it("assigns MODERATE priority for blood glucose >= 140 and < 200", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 160 });
      const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(glucose?.priority).toBe("moderate");
    });

    it("assigns MONITOR priority for blood glucose < 140", () => {
      const result = generateAttentionNavigator({ bloodGlucoseLevel: 100 });
      const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(glucose?.priority).toBe("monitor");
    });
  });

  describe("BMI factor", () => {
    it("assigns MODERATE priority for BMI >= 30", () => {
      const result = generateAttentionNavigator({ bmi: 32 });
      const bmi = result.priorities.find(p => p.factor === "BMI");
      expect(bmi?.priority).toBe("moderate");
      expect(bmi?.value).toBe(32);
    });

    it("assigns MONITOR priority for BMI >= 25 and < 30", () => {
      const result = generateAttentionNavigator({ bmi: 27 });
      const bmi = result.priorities.find(p => p.factor === "BMI");
      expect(bmi?.priority).toBe("monitor");
    });

    it("assigns MONITOR priority for BMI < 25", () => {
      const result = generateAttentionNavigator({ bmi: 22 });
      const bmi = result.priorities.find(p => p.factor === "BMI");
      expect(bmi?.priority).toBe("monitor");
    });
  });

  describe("hypertension flag", () => {
    it("adds MODERATE priority factor when hypertension is true", () => {
      const result = generateAttentionNavigator({ hypertension: true });
      const ht = result.priorities.find(p => p.factor === "Hypertension");
      expect(ht?.priority).toBe("moderate");
      expect(ht?.reason).toContain("cardiovascular");
    });

    it("does not add hypertension factor when false", () => {
      const result = generateAttentionNavigator({ hypertension: false });
      const ht = result.priorities.find(p => p.factor === "Hypertension");
      expect(ht).toBeUndefined();
    });
  });

  describe("heart disease flag", () => {
    it("adds HIGH priority factor when heartDisease is true", () => {
      const result = generateAttentionNavigator({ heartDisease: true });
      const hd = result.priorities.find(p => p.factor === "Heart Disease");
      expect(hd?.priority).toBe("high");
      expect(hd?.reason).toContain("cardiovascular");
    });

    it("does not add heart disease factor when false", () => {
      const result = generateAttentionNavigator({ heartDisease: false });
      const hd = result.priorities.find(p => p.factor === "Heart Disease");
      expect(hd).toBeUndefined();
    });
  });

  describe("smoking normalization", () => {
    it("adds MODERATE priority smoking factor for current smoking", () => {
      const result = generateAttentionNavigator({ smokingHistory: "current" });
      const sm = result.priorities.find(p => p.factor === "Smoking History");
      expect(sm?.priority).toBe("moderate");
    });

    it("adds MONITOR priority smoking factor for former smoking", () => {
      const result = generateAttentionNavigator({ smokingHistory: "former" });
      const sm = result.priorities.find(p => p.factor === "Smoking History");
      expect(sm?.priority).toBe("monitor");
    });

    it("does not add smoking factor for never-smoked", () => {
      const result = generateAttentionNavigator({ smokingHistory: "never" });
      const sm = result.priorities.find(p => p.factor === "Smoking History");
      expect(sm).toBeUndefined();
    });

    it("does not add smoking factor when smokingHistory is absent", () => {
      const result = generateAttentionNavigator({});
      const sm = result.priorities.find(p => p.factor === "Smoking History");
      expect(sm).toBeUndefined();
    });

    it("normalizes mixed-case smoking values correctly", () => {
      const result = generateAttentionNavigator({ smokingHistory: "CURRENT Smoker" });
      const sm = result.priorities.find(p => p.factor === "Smoking History");
      expect(sm?.priority).toBe("moderate");
    });

    it("treats unknown smoking values as unknown (no factor added)", () => {
      const result = generateAttentionNavigator({ smokingHistory: "unknown-status" });
      const sm = result.priorities.find(p => p.factor === "Smoking History");
      expect(sm).toBeUndefined();
    });
  });

  describe("factors deduplication", () => {
    it("keeps only the highest-priority entry per factor", () => {
      // Both HIGH and MODERATE risk category would normally add separate entries,
      // but the deduplication should keep HIGH
      const result = generateAttentionNavigator({ riskCategory: "HIGH", heartDisease: true });
      const rcFactors = result.priorities.filter(p => p.factor === "Risk category");
      expect(rcFactors).toHaveLength(1);
      expect(rcFactors[0]?.priority).toBe("high");
    });
  });

  describe("priority ordering", () => {
    it("sorts priorities with HIGH before MODERATE before monitor", () => {
      const result = generateAttentionNavigator({
        riskCategory: "HIGH",
        heartDisease: true,
        hypertension: true,
        bmi: 32,
        hba1cLevel: 5.5,
      });

      const priorities = result.priorities;
      const highCount = priorities.filter(p => p.priority === "high").length;
      const moderateCount = priorities.filter(p => p.priority === "moderate").length;

      expect(highCount).toBeGreaterThan(0);
      expect(moderateCount).toBeGreaterThan(0);

      // All HIGH factors come before any MODERATE
      const firstModerate = priorities.findIndex(p => p.priority === "moderate");
      const lastHigh = priorities.findLastIndex(p => p.priority === "high");
      expect(lastHigh).toBeLessThan(firstModerate);
    });
  });

  describe("returns AttentionNavigator shape", () => {
    it("returns an object with priorities array", () => {
      const result = generateAttentionNavigator({});
      expect(result).toHaveProperty("priorities");
      expect(Array.isArray(result.priorities)).toBe(true);
    });
  });
});
