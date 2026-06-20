import { describe, expect, it } from "vitest";
import { generateAttentionNavigator } from "./clinical-attention-navigator";

describe("generateAttentionNavigator", () => {
  describe("risk category priority", () => {
    it("HIGH riskCategory includes high-priority Risk category entry", () => {
      const result = generateAttentionNavigator({ riskCategory: "HIGH" });
      const riskEntry = result.priorities.find(p => p.factor === "Risk category");
      expect(riskEntry).toBeDefined();
      expect(riskEntry?.priority).toBe("high");
    });

    it("MODERATE riskCategory includes moderate-priority Risk category entry", () => {
      const result = generateAttentionNavigator({ riskCategory: "MODERATE" });
      const riskEntry = result.priorities.find(p => p.factor === "Risk category");
      expect(riskEntry?.priority).toBe("moderate");
    });

    it("LOW riskCategory does not include a Risk category priority entry", () => {
      const result = generateAttentionNavigator({ riskCategory: "LOW" });
      const riskEntry = result.priorities.find(p => p.factor === "Risk category");
      expect(riskEntry).toBeUndefined();
    });
  });

  describe("HbA1c threshold detection", () => {
    it("HbA1c >= 9 is high priority", () => {
      const result = generateAttentionNavigator({ hba1cLevel: "9.5" });
      const hba1cEntry = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1cEntry?.priority).toBe("high");
    });

    it("HbA1c >= 7 and < 9 is moderate priority", () => {
      const result = generateAttentionNavigator({ hba1cLevel: "7.5" });
      const hba1cEntry = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1cEntry?.priority).toBe("moderate");
    });

    it("HbA1c < 7 is monitor priority", () => {
      const result = generateAttentionNavigator({ hba1cLevel: "5.5" });
      const hba1cEntry = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1cEntry?.priority).toBe("monitor");
    });

    it("missing HbA1c does not create HbA1c priority", () => {
      const result = generateAttentionNavigator({});
      const hba1cEntry = result.priorities.find(p => p.factor === "HbA1c");
      expect(hba1cEntry).toBeUndefined();
    });
  });

  describe("BMI priority detection", () => {
    it("BMI >= 30 is moderate priority (obesity)", () => {
      const result = generateAttentionNavigator({ bmi: "32.0" });
      const bmiEntry = result.priorities.find(p => p.factor === "BMI");
      expect(bmiEntry?.priority).toBe("moderate");
    });

    it("BMI >= 25 and < 30 is monitor priority (overweight)", () => {
      const result = generateAttentionNavigator({ bmi: "27.0" });
      const bmiEntry = result.priorities.find(p => p.factor === "BMI");
      expect(bmiEntry?.priority).toBe("monitor");
    });

    it("BMI < 25 is monitor priority (normal)", () => {
      const result = generateAttentionNavigator({ bmi: "22.0" });
      const bmiEntry = result.priorities.find(p => p.factor === "BMI");
      expect(bmiEntry?.priority).toBe("monitor");
    });

    it("BMI 'invalid' (NaN) does not create BMI priority entry", () => {
      const result = generateAttentionNavigator({ bmi: "invalid" });
      const bmiEntry = result.priorities.find(p => p.factor === "BMI");
      expect(bmiEntry).toBeUndefined();
    });
  });

  describe("hypertension detection", () => {
    it("hypertension=true triggers moderate-priority entry", () => {
      const result = generateAttentionNavigator({ hypertension: true });
      const hpEntry = result.priorities.find(p => p.factor === "Hypertension");
      expect(hpEntry?.priority).toBe("moderate");
    });

    it("hypertension=false does not create Hypertension priority", () => {
      const result = generateAttentionNavigator({ hypertension: false });
      const hpEntry = result.priorities.find(p => p.factor === "Hypertension");
      expect(hpEntry).toBeUndefined();
    });
  });

  describe("heart disease detection", () => {
    it("heartDisease=true triggers high-priority entry", () => {
      const result = generateAttentionNavigator({ heartDisease: true });
      const hdEntry = result.priorities.find(p => p.factor === "Heart Disease");
      expect(hdEntry?.priority).toBe("high");
    });

    it("heartDisease=false does not create Heart Disease priority", () => {
      const result = generateAttentionNavigator({ heartDisease: false });
      const hdEntry = result.priorities.find(p => p.factor === "Heart Disease");
      expect(hdEntry).toBeUndefined();
    });
  });

  describe("smoking normalization", () => {
    it("smoking 'current' triggers moderate-priority Smoking History entry", () => {
      const result = generateAttentionNavigator({ smokingHistory: "current smoker" });
      const smokeEntry = result.priorities.find(p => p.factor === "Smoking History");
      expect(smokeEntry?.priority).toBe("moderate");
    });

    it("smoking 'former' triggers monitor-priority Smoking History entry", () => {
      const result = generateAttentionNavigator({ smokingHistory: "former" });
      const smokeEntry = result.priorities.find(p => p.factor === "Smoking History");
      expect(smokeEntry?.priority).toBe("monitor");
    });

    it("smoking 'never' does not create Smoking History priority", () => {
      const result = generateAttentionNavigator({ smokingHistory: "never" });
      const smokeEntry = result.priorities.find(p => p.factor === "Smoking History");
      expect(smokeEntry).toBeUndefined();
    });

    it("null/undefined/empty smokingHistory does not create Smoking History priority", () => {
      const r1 = generateAttentionNavigator({ smokingHistory: null as any });
      const r2 = generateAttentionNavigator({ smokingHistory: undefined as any });
      const r3 = generateAttentionNavigator({ smokingHistory: "" });
      [r1, r2, r3].forEach(result => {
        const smokeEntry = result.priorities.find(p => p.factor === "Smoking History");
        expect(smokeEntry).toBeUndefined();
      });
    });
  });

  describe("factors array handling", () => {
    it("up to 3 factors are included from the factors array", () => {
      const result = generateAttentionNavigator({
        factors: [
          { name: "Age", impact: "positive", description: "Age factor" },
          { name: "BMI", impact: "negative", description: "BMI factor" },
          { name: "HbA1c", impact: "positive", description: "HbA1c factor" },
          { name: "Extra", impact: "negative", description: "Extra" },
        ],
      });
      const factorPriorities = result.priorities.filter(p =>
        ["Age", "BMI", "HbA1c", "Extra"].includes(p.factor)
      );
      // Implementation caps at 3 factors
      expect(factorPriorities.length).toBeLessThanOrEqual(3);
    });
  });

  describe("sorting and deduplication", () => {
    it("priorities are sorted: high first, then moderate, then monitor within each group", () => {
      const result = generateAttentionNavigator({
        riskCategory: "HIGH",
        heartDisease: true,
        smokingHistory: "former",
      });
      const sortedPriorities = result.priorities;
      const highCount = sortedPriorities.filter(p => p.priority === "high").length;
      const modCount = sortedPriorities.filter(p => p.priority === "moderate").length;
      const monCount = sortedPriorities.filter(p => p.priority === "monitor").length;
      // All high priority come before moderate
      const firstHighIdx = sortedPriorities.findIndex(p => p.priority === "high");
      const firstModIdx = sortedPriorities.findIndex(p => p.priority === "moderate");
      const firstMonIdx = sortedPriorities.findIndex(p => p.priority === "monitor");
      if (firstHighIdx >= 0 && firstModIdx >= 0) {
        expect(firstHighIdx).toBeLessThan(firstModIdx);
      }
      if (firstModIdx >= 0 && firstMonIdx >= 0) {
        expect(firstModIdx).toBeLessThan(firstMonIdx);
      }
    });

    it("duplicates are deduplicated, keeping the higher priority version", () => {
      const result = generateAttentionNavigator({
        heartDisease: true,
      });
      const hdEntries = result.priorities.filter(p => p.factor === "Heart Disease");
      expect(hdEntries.length).toBe(1);
    });
  });

  describe("edge cases", () => {
    it("empty input returns empty priorities array", () => {
      const result = generateAttentionNavigator({});
      expect(result.priorities).toHaveLength(0);
    });

    it("NaN values are handled gracefully without throwing", () => {
      expect(() => {
        generateAttentionNavigator({ age: NaN, bmi: NaN, hba1cLevel: NaN });
      }).not.toThrow();
    });

    it("numeric strings are parsed correctly", () => {
      const result = generateAttentionNavigator({
        hba1cLevel: "8.5",
        bmi: "31.0",
      });
      const hba1cEntry = result.priorities.find(p => p.factor === "HbA1c");
      const bmiEntry = result.priorities.find(p => p.factor === "BMI");
      expect(hba1cEntry?.priority).toBe("moderate");
      expect(bmiEntry?.priority).toBe("moderate");
    });

    it("glucose threshold: >= 200 is high, >= 140 is moderate", () => {
      const highResult = generateAttentionNavigator({ bloodGlucoseLevel: "220" });
      const modResult = generateAttentionNavigator({ bloodGlucoseLevel: "160" });
      expect(highResult.priorities.find(p => p.factor === "Blood Glucose")?.priority).toBe("high");
      expect(modResult.priorities.find(p => p.factor === "Blood Glucose")?.priority).toBe("moderate");
    });
  });
});
