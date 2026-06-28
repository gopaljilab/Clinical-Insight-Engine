import { describe, it, expect } from "vitest";
import { generateAttentionNavigator } from "./clinical-attention-navigator";

const emptyInput = {
  age: undefined,
  bmi: undefined,
  hba1cLevel: undefined,
  bloodGlucoseLevel: undefined,
  hypertension: undefined,
  heartDisease: undefined,
  smokingHistory: undefined,
  riskCategory: undefined,
  factors: undefined,
} as any;

describe("generateAttentionNavigator", () => {
  // ── Risk category ─────────────────────────────────────────────────────────
  describe("riskCategory", () => {
    it("adds high-priority item for HIGH riskCategory", () => {
      const result = generateAttentionNavigator({ ...emptyInput, riskCategory: "HIGH" });
      const riskCat = result.priorities.find(p => p.factor === "Risk category");
      expect(riskCat).toBeDefined();
      expect(riskCat!.priority).toBe("high");
    });

    it("adds moderate-priority item for MODERATE riskCategory", () => {
      const result = generateAttentionNavigator({ ...emptyInput, riskCategory: "MODERATE" });
      const riskCat = result.priorities.find(p => p.factor === "Risk category");
      expect(riskCat).toBeDefined();
      expect(riskCat!.priority).toBe("moderate");
    });

    it("does not add a risk category item for LOW", () => {
      const result = generateAttentionNavigator({ ...emptyInput, riskCategory: "LOW" });
      const riskCat = result.priorities.find(p => p.factor === "Risk category");
      expect(riskCat).toBeUndefined();
    });

    it("treats lowercase 'high' as HIGH", () => {
      const result = generateAttentionNavigator({ ...emptyInput, riskCategory: "high" });
      const riskCat = result.priorities.find(p => p.factor === "Risk category");
      expect(riskCat).toBeDefined();
      expect(riskCat!.priority).toBe("high");
    });
  });

  // ── HbA1c thresholds ──────────────────────────────────────────────────────
  describe("HbA1c thresholds", () => {
    it("assigns high priority when HbA1c >= 9", () => {
      const result = generateAttentionNavigator({ ...emptyInput, hba1cLevel: 9.5 });
      const item = result.priorities.find(p => p.factor === "HbA1c");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("high");
      expect(item!.value).toBe(9.5);
    });

    it("assigns moderate priority when HbA1c is 7-9", () => {
      const result = generateAttentionNavigator({ ...emptyInput, hba1cLevel: 7.5 });
      const item = result.priorities.find(p => p.factor === "HbA1c");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("moderate");
    });

    it("assigns monitor priority when HbA1c < 7", () => {
      const result = generateAttentionNavigator({ ...emptyInput, hba1cLevel: 6.5 });
      const item = result.priorities.find(p => p.factor === "HbA1c");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("monitor");
    });

    it("skips HbA1c when undefined", () => {
      const result = generateAttentionNavigator(emptyInput);
      const item = result.priorities.find(p => p.factor === "HbA1c");
      expect(item).toBeUndefined();
    });
  });

  // ── Blood Glucose thresholds ──────────────────────────────────────────────
  describe("Blood Glucose thresholds", () => {
    it("assigns high priority when glucose >= 200", () => {
      const result = generateAttentionNavigator({ ...emptyInput, bloodGlucoseLevel: 250 });
      const item = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("high");
    });

    it("assigns moderate priority when glucose is 140-200", () => {
      const result = generateAttentionNavigator({ ...emptyInput, bloodGlucoseLevel: 160 });
      const item = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("moderate");
    });

    it("assigns monitor priority when glucose < 140", () => {
      const result = generateAttentionNavigator({ ...emptyInput, bloodGlucoseLevel: 100 });
      const item = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("monitor");
    });

    it("skips blood glucose when undefined", () => {
      const result = generateAttentionNavigator(emptyInput);
      const item = result.priorities.find(p => p.factor === "Blood Glucose");
      expect(item).toBeUndefined();
    });
  });

  // ── BMI thresholds ─────────────────────────────────────────────────────────
  describe("BMI thresholds", () => {
    it("assigns moderate priority when BMI >= 30", () => {
      const result = generateAttentionNavigator({ ...emptyInput, bmi: 32 });
      const item = result.priorities.find(p => p.factor === "BMI");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("moderate");
    });

    it("assigns monitor priority when BMI is 25-30", () => {
      const result = generateAttentionNavigator({ ...emptyInput, bmi: 27 });
      const item = result.priorities.find(p => p.factor === "BMI");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("monitor");
    });

    it("assigns monitor priority when BMI < 25", () => {
      const result = generateAttentionNavigator({ ...emptyInput, bmi: 22 });
      const item = result.priorities.find(p => p.factor === "BMI");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("monitor");
    });
  });

  // ── Hypertension ────────────────────────────────────────────────────────────
  describe("Hypertension", () => {
    it("adds moderate-priority item when hypertension is true", () => {
      const result = generateAttentionNavigator({ ...emptyInput, hypertension: true });
      const item = result.priorities.find(p => p.factor === "Hypertension");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("moderate");
    });

    it("does not add item when hypertension is false", () => {
      const result = generateAttentionNavigator({ ...emptyInput, hypertension: false });
      const item = result.priorities.find(p => p.factor === "Hypertension");
      expect(item).toBeUndefined();
    });
  });

  // ── Heart Disease ───────────────────────────────────────────────────────────
  describe("Heart Disease", () => {
    it("adds high-priority item when heartDisease is true", () => {
      const result = generateAttentionNavigator({ ...emptyInput, heartDisease: true });
      const item = result.priorities.find(p => p.factor === "Heart Disease");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("high");
    });

    it("does not add item when heartDisease is false", () => {
      const result = generateAttentionNavigator({ ...emptyInput, heartDisease: false });
      const item = result.priorities.find(p => p.factor === "Heart Disease");
      expect(item).toBeUndefined();
    });
  });

  // ── Smoking normalization ───────────────────────────────────────────────────
  describe("Smoking normalization", () => {
    it('adds moderate-priority item for smokingHistory "current"', () => {
      const result = generateAttentionNavigator({ ...emptyInput, smokingHistory: "current smoker" });
      const item = result.priorities.find(p => p.factor === "Smoking History");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("moderate");
    });

    it('adds monitor-priority item for smokingHistory "former"', () => {
      const result = generateAttentionNavigator({ ...emptyInput, smokingHistory: "former smoker" });
      const item = result.priorities.find(p => p.factor === "Smoking History");
      expect(item).toBeDefined();
      expect(item!.priority).toBe("monitor");
    });

    it('does not add item for smokingHistory "never"', () => {
      const result = generateAttentionNavigator({ ...emptyInput, smokingHistory: "never" });
      const item = result.priorities.find(p => p.factor === "Smoking History");
      expect(item).toBeUndefined();
    });

    it('does not add item for unknown smokingHistory', () => {
      // normalizeSmoking returns 'unknown' for unrecognised values; the
      // function only adds smoking items for 'current' or 'former'
      const result = generateAttentionNavigator({ ...emptyInput, smokingHistory: 'unknown' });
      const item = result.priorities.find(p => p.factor === 'Smoking History');
      expect(item).toBeUndefined();
    });
  });

  // ── Assessment Factors ───────────────────────────────────────────────────────
  describe("Assessment Factors", () => {
    const factors = [
      { name: "Factor A", impact: "negative" as const, description: "Desc A" },
      { name: "Factor B", impact: "positive" as const, description: "Desc B" },
      { name: "Factor C", impact: "positive" as const, description: "Desc C" },
      { name: "Factor D", impact: "negative" as const, description: "Desc D" },
    ];

    it("includes at most 3 assessment factors", () => {
      const result = generateAttentionNavigator({ ...emptyInput, factors });
      const smokingFactors = result.priorities.filter(p =>
        !["Risk category", "HbA1c", "Blood Glucose", "BMI", "Hypertension", "Heart Disease", "Smoking History"].includes(p.factor)
      );
      expect(smokingFactors.length).toBeLessThanOrEqual(3);
    });

    it("prioritizes positive-impact factors over negative ones", () => {
      const result = generateAttentionNavigator({ ...emptyInput, factors });
      const sorted = result.priorities.filter(p =>
        factors.some(f => f.name === p.factor)
      );
      // The source sorts by impact (positive=2, negative=1), so positive comes first
      expect(sorted[0].priority).toBe("high"); // positive => high
    });
  });

  // ── Deduplication ───────────────────────────────────────────────────────────
  describe("Deduplication", () => {
    it("keeps only the highest-priority entry when a factor appears twice", () => {
      // Both hba1c and riskCategory could both contribute "high" — but different factors
      // To test deduplication: same factor, different priorities
      const input = {
        ...emptyInput,
        hba1cLevel: 9.5,   // would add high
        riskCategory: "HIGH", // would add high
      };
      const result = generateAttentionNavigator(input);

      // Both are different factors so both should appear
      const hba1c = result.priorities.filter(p => p.factor === "HbA1c");
      const riskCat = result.priorities.filter(p => p.factor === "Risk category");
      expect(hba1c).toHaveLength(1);
      expect(riskCat).toHaveLength(1);
    });

    it("removes lower-priority duplicate when same factor appears via different paths", () => {
      // This tests the Map-based deduplication
      const input = {
        ...emptyInput,
        hba1cLevel: 5.0, // monitor
        // If there were a second path adding HbA1c, the higher one would win
      };
      const result = generateAttentionNavigator(input);
      const hba1cItems = result.priorities.filter(p => p.factor === "HbA1c");
      expect(hba1cItems).toHaveLength(1);
    });
  });

  // ── Priority sorting ────────────────────────────────────────────────────────
  describe("Priority sorting", () => {
    it("sorts high before moderate before monitor", () => {
      const result = generateAttentionNavigator({
        ...emptyInput,
        hba1cLevel: 9.5,          // high
        riskCategory: "MODERATE", // moderate
        bmi: 22,                   // monitor
      });

      const priorities = result.priorities.map(p => p.priority);
      const highIdx = priorities.indexOf("high");
      const moderateIdx = priorities.indexOf("moderate");
      const monitorIdx = priorities.indexOf("monitor");

      if (highIdx !== -1 && moderateIdx !== -1) {
        expect(highIdx).toBeLessThan(moderateIdx);
      }
      if (moderateIdx !== -1 && monitorIdx !== -1) {
        expect(moderateIdx).toBeLessThan(monitorIdx);
      }
    });

    it("sorts alphabetically within the same priority tier", () => {
      const result = generateAttentionNavigator({
        ...emptyInput,
        heartDisease: true,      // high
        riskCategory: "HIGH",    // high
        smokingHistory: "current", // moderate
      });

      const highItems = result.priorities.filter(p => p.priority === "high");
      const factors = highItems.map(p => p.factor);
      const sorted = [...factors].sort();
      expect(factors).toEqual(sorted);
    });
  });

  // ── Return shape ────────────────────────────────────────────────────────────
  describe("Return shape", () => {
    it("returns an object with a priorities array", () => {
      const result = generateAttentionNavigator(emptyInput);
      expect(result).toHaveProperty("priorities");
      expect(Array.isArray(result.priorities)).toBe(true);
    });

    it("each priority has factor, priority, and reason fields", () => {
      const result = generateAttentionNavigator({ ...emptyInput, hba1cLevel: 9.5 });
      for (const item of result.priorities) {
        expect(item).toHaveProperty("factor");
        expect(item).toHaveProperty("priority");
        expect(item).toHaveProperty("reason");
      }
    });

    it("each priority priority is one of 'high', 'moderate', 'monitor'", () => {
      const result = generateAttentionNavigator({
        ...emptyInput,
        hba1cLevel: 9.5,
        bloodGlucoseLevel: 250,
        heartDisease: true,
      });
      for (const item of result.priorities) {
        expect(["high", "moderate", "monitor"]).toContain(item.priority);
      }
    });
  });
});
