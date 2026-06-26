import { describe, it, expect } from "vitest";
import { generateAttentionNavigator } from "./clinical-attention-navigator";

function nav(input: any) {
  return generateAttentionNavigator(input as any);
}

function getPriority(navResult: any, factor: string) {
  return navResult.priorities.find((p: any) => p.factor.toLowerCase() === factor.toLowerCase());
}

describe("generateAttentionNavigator", () => {
  describe("risk category", () => {
    it("adds high priority for HIGH risk category", () => {
      const result = nav({ riskCategory: "HIGH" });
      const p = getPriority(result, "Risk category");
      expect(p?.priority).toBe("high");
    });

    it("adds moderate priority for MODERATE risk category", () => {
      const result = nav({ riskCategory: "MODERATE" });
      const p = getPriority(result, "Risk category");
      expect(p?.priority).toBe("moderate");
    });

    it("does not add category priority for LOW risk", () => {
      const result = nav({ riskCategory: "LOW" });
      const p = getPriority(result, "Risk category");
      expect(p).toBeUndefined();
    });
  });

  describe("HbA1c thresholds", () => {
    it("returns high priority for HbA1c >= 9", () => {
      const result = nav({ hba1cLevel: 9.5 });
      const p = getPriority(result, "HbA1c");
      expect(p?.priority).toBe("high");
    });

    it("returns moderate priority for HbA1c between 7 and 9", () => {
      const result = nav({ hba1cLevel: 7.5 });
      const p = getPriority(result, "HbA1c");
      expect(p?.priority).toBe("moderate");
    });

    it("returns monitor priority for HbA1c below 7", () => {
      const result = nav({ hba1cLevel: 5.5 });
      const p = getPriority(result, "HbA1c");
      expect(p?.priority).toBe("monitor");
    });

    it("does not add HbA1c priority for undefined value", () => {
      const result = nav({});
      const p = getPriority(result, "HbA1c");
      expect(p).toBeUndefined();
    });
  });

  describe("blood glucose thresholds", () => {
    it("returns high priority for glucose >= 200", () => {
      const result = nav({ bloodGlucoseLevel: 250 });
      const p = getPriority(result, "Blood Glucose");
      expect(p?.priority).toBe("high");
    });

    it("returns moderate priority for glucose between 140 and 200", () => {
      const result = nav({ bloodGlucoseLevel: 160 });
      const p = getPriority(result, "Blood Glucose");
      expect(p?.priority).toBe("moderate");
    });

    it("returns monitor priority for glucose below 140", () => {
      const result = nav({ bloodGlucoseLevel: 100 });
      const p = getPriority(result, "Blood Glucose");
      expect(p?.priority).toBe("monitor");
    });

    it("does not add glucose priority for undefined value", () => {
      const result = nav({});
      const p = getPriority(result, "Blood Glucose");
      expect(p).toBeUndefined();
    });
  });

  describe("BMI thresholds", () => {
    it("returns moderate priority for BMI >= 30", () => {
      const result = nav({ bmi: 32 });
      const p = getPriority(result, "BMI");
      expect(p?.priority).toBe("moderate");
    });

    it("returns monitor priority for BMI between 25 and 30", () => {
      const result = nav({ bmi: 27 });
      const p = getPriority(result, "BMI");
      expect(p?.priority).toBe("monitor");
    });

    it("returns monitor priority for BMI below 25", () => {
      const result = nav({ bmi: 22 });
      const p = getPriority(result, "BMI");
      expect(p?.priority).toBe("monitor");
    });
  });

  describe("comorbidity flags", () => {
    it("adds moderate priority for hypertension", () => {
      const result = nav({ hypertension: true });
      const p = getPriority(result, "Hypertension");
      expect(p?.priority).toBe("moderate");
    });

    it("adds high priority for heart disease", () => {
      const result = nav({ heartDisease: true });
      const p = getPriority(result, "Heart Disease");
      expect(p?.priority).toBe("high");
    });
  });

  describe("smoking history normalization", () => {
    it("returns moderate priority for current smoker", () => {
      const result = nav({ smokingHistory: "current" });
      const p = getPriority(result, "Smoking History");
      expect(p?.priority).toBe("moderate");
    });

    it("returns monitor priority for former smoker", () => {
      const result = nav({ smokingHistory: "former" });
      const p = getPriority(result, "Smoking History");
      expect(p?.priority).toBe("monitor");
    });

    it("does not add priority for undefined smoking history", () => {
      const result = nav({});
      const p = getPriority(result, "Smoking History");
      expect(p).toBeUndefined();
    });

    it("normalizes case-insensitive smoking history", () => {
      const result = nav({ smokingHistory: "CURRENT SMOKER" });
      const p = getPriority(result, "Smoking History");
      expect(p?.priority).toBe("moderate");
    });
  });

  describe("factor deduplication", () => {
    it("de-duplicates same factor, keeping higher priority", () => {
      const result = nav({ riskCategory: "HIGH", hba1cLevel: 10 });
      const riskCatEntries = result.priorities.filter((p: any) => p.factor === "Risk category");
      expect(riskCatEntries.length).toBe(1);
      expect(getPriority(result, "Risk category")?.priority).toBe("high");
    });
  });

  describe("sorting", () => {
    it("sorts priorities: high before moderate", () => {
      const result = nav({ riskCategory: "HIGH", hypertension: true });
      const priorities = result.priorities;
      const highIdx = priorities.findIndex((p: any) => p.priority === "high");
      const moderateIdx = priorities.findIndex((p: any) => p.priority === "moderate");
      expect(highIdx).toBeLessThan(moderateIdx);
    });
  });
});
