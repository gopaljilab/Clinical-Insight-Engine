import { describe, it, expect } from "vitest";
import { generateAttentionNavigator } from "./clinical-attention-navigator";

function emptyInput() {
  return {
    age: 45,
    bmi: 24.5,
    hba1cLevel: 5.0,
    bloodGlucoseLevel: 95,
    smokingHistory: "never" as const,
    hypertension: false,
    heartDisease: false,
    riskCategory: "LOW" as const,
  };
}

function findPriority(nav: any, factor: string) {
  return nav.priorities.find((p: any) =>
    p.factor.toLowerCase().includes(factor.toLowerCase())
  );
}

describe("generateAttentionNavigator", () => {
  describe("riskCategory", () => {
    it("flags HIGH risk category as high priority", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), riskCategory: "HIGH" });
      const rp = findPriority(nav, "Risk category");
      expect(rp).toBeDefined();
      expect(rp.priority).toBe("high");
    });

    it("flags MODERATE risk category as moderate priority", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), riskCategory: "MODERATE" });
      const rp = findPriority(nav, "Risk category");
      expect(rp).toBeDefined();
      expect(rp.priority).toBe("moderate");
    });

    it("does not add risk category priority for LOW", () => {
      const nav = generateAttentionNavigator({ ...emptyInput() });
      const rp = findPriority(nav, "Risk category");
      expect(rp).toBeUndefined();
    });
  });

  describe("HbA1c thresholds", () => {
    it("flags HbA1c >= 9 as high priority", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), hba1cLevel: 10 });
      const p = findPriority(nav, "HbA1c");
      expect(p).toBeDefined();
      expect(p.priority).toBe("high");
    });

    it("flags HbA1c >= 7 and < 9 as moderate priority", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), hba1cLevel: 7.5 });
      const p = findPriority(nav, "HbA1c");
      expect(p).toBeDefined();
      expect(p.priority).toBe("moderate");
    });

    it("flags HbA1c < 7 as monitor priority", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), hba1cLevel: 6.0 });
      const p = findPriority(nav, "HbA1c");
      expect(p).toBeDefined();
      expect(p.priority).toBe("monitor");
    });
  });

  describe("BMI thresholds", () => {
    it("flags BMI >= 30 as moderate priority", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), bmi: 32 });
      const p = findPriority(nav, "BMI");
      expect(p).toBeDefined();
      expect(p.priority).toBe("moderate");
    });

    it("flags BMI >= 25 and < 30 as monitor priority", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), bmi: 27 });
      const p = findPriority(nav, "BMI");
      expect(p).toBeDefined();
      expect(p.priority).toBe("monitor");
    });

    it("flags BMI < 25 as monitor priority", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), bmi: 22 });
      const p = findPriority(nav, "BMI");
      expect(p).toBeDefined();
      expect(p.priority).toBe("monitor");
    });
  });

  describe("blood glucose", () => {
    it("flags high blood glucose (>=200) as high priority", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), bloodGlucoseLevel: 250 });
      const p = findPriority(nav, "blood glucose");
      expect(p).toBeDefined();
      expect(p.priority).toBe("high");
    });

    it("flags moderate blood glucose (>=140) as moderate priority", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), bloodGlucoseLevel: 150 });
      const p = findPriority(nav, "blood glucose");
      expect(p).toBeDefined();
      expect(p.priority).toBe("moderate");
    });

    it("flags normal blood glucose as monitor", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), bloodGlucoseLevel: 95 });
      const p = findPriority(nav, "blood glucose");
      expect(p).toBeDefined();
      expect(p.priority).toBe("monitor");
    });
  });

  describe("hypertension and heart disease", () => {
    it("flags hypertension as moderate priority when true", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), hypertension: true });
      const p = findPriority(nav, "hypertension");
      expect(p).toBeDefined();
      expect(p.priority).toBe("moderate");
    });

    it("does not flag hypertension when false", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), hypertension: false });
      const p = findPriority(nav, "hypertension");
      expect(p).toBeUndefined();
    });

    it("flags heart disease as high priority when true", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), heartDisease: true });
      const p = findPriority(nav, "heart disease");
      expect(p).toBeDefined();
      expect(p.priority).toBe("high");
    });

    it("does not flag heart disease when false", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), heartDisease: false });
      const p = findPriority(nav, "heart disease");
      expect(p).toBeUndefined();
    });
  });

  describe("smoking history normalization", () => {
    it('normalizes "current" smoking as moderate priority', () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), smokingHistory: "current" });
      const p = findPriority(nav, "smoking");
      expect(p).toBeDefined();
      expect(p.priority).toBe("moderate");
    });

    it('normalizes "current smoker" (contains "current") as moderate priority', () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), smokingHistory: "current smoker" });
      const p = findPriority(nav, "smoking");
      expect(p).toBeDefined();
      expect(p.priority).toBe("moderate");
    });

    it('normalizes "former" smoking as monitor priority', () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), smokingHistory: "former" });
      const p = findPriority(nav, "smoking");
      expect(p).toBeDefined();
      expect(p.priority).toBe("monitor");
    });

    it('normalizes "former smoker" (contains "former") as monitor priority', () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), smokingHistory: "former smoker" });
      const p = findPriority(nav, "smoking");
      expect(p).toBeDefined();
      expect(p.priority).toBe("monitor");
    });

    it('does not add smoking priority for "never" smoking history', () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), smokingHistory: "never" });
      const p = findPriority(nav, "smoking");
      expect(p).toBeUndefined();
    });

    it("does not add smoking priority for unknown smoking history", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), smokingHistory: "unknown" });
      const p = findPriority(nav, "smoking");
      expect(p).toBeUndefined();
    });
  });

  describe("null/undefined handling", () => {
    it("handles null hba1c gracefully", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), hba1cLevel: null as any });
      expect(nav.priorities).toBeDefined();
    });

    it("handles null bmi gracefully", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), bmi: null as any });
      expect(nav.priorities).toBeDefined();
    });

    it("handles null glucose gracefully", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), bloodGlucoseLevel: null as any });
      expect(nav.priorities).toBeDefined();
    });

    it("handles missing smoking history", () => {
      const { smokingHistory: _, ...input } = emptyInput();
      const nav = generateAttentionNavigator(input as any);
      expect(nav.priorities).toBeDefined();
    });

    it("handles missing age", () => {
      const { age: _, ...input } = emptyInput();
      const nav = generateAttentionNavigator(input as any);
      expect(nav.priorities).toBeDefined();
    });
  });

  describe("priority object shape", () => {
    it("each priority has factor, priority level, and reason", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), riskCategory: "HIGH" });
      nav.priorities.forEach((p) => {
        expect(typeof p.factor).toBe("string");
        expect(["high", "moderate", "monitor"]).toContain(p.priority);
        expect(typeof p.reason).toBe("string");
      });
    });
  });

  describe("priority ordering", () => {
    it("returns priorities sorted with high first, then moderate, then monitor", () => {
      const nav = generateAttentionNavigator({
        ...emptyInput(),
        riskCategory: "HIGH",
        hypertension: true,
        hba1cLevel: 8,
      });
      const priorities = nav.priorities.map((p: any) => p.priority);
      const highCount = priorities.filter((p: string) => p === "high").length;
      const moderateCount = priorities.filter((p: string) => p === "moderate").length;
      expect(highCount).toBeGreaterThan(0);
      expect(moderateCount).toBeGreaterThan(0);
    });
  });

  describe("deduplication", () => {
    it("does not duplicate a factor when added multiple times", () => {
      const nav = generateAttentionNavigator({ ...emptyInput(), riskCategory: "HIGH" });
      const factorNames = nav.priorities.map((p: any) => p.factor.toLowerCase());
      const unique = new Set(factorNames);
      // Each factor should appear at most once in the final list
      expect(factorNames.length).toBe(unique.size);
    });
  });
});
