import { generateAttentionNavigator } from "./clinical-attention-navigator";

function getPriority(nav: ReturnType<typeof generateAttentionNavigator>, factor: string) {
  return nav.priorities.find((p) => p.factor.toLowerCase() === factor.toLowerCase());
}

function getPriorityByLabel(nav: ReturnType<typeof generateAttentionNavigator>, label: string) {
  return nav.priorities.find((p) => p.factor === label);
}

describe("generateAttentionNavigator", () => {
  describe("risk category", () => {
    it("adds high priority for HIGH risk category", () => {
      const nav = generateAttentionNavigator({ riskCategory: "HIGH" });
      const p = getPriorityByLabel(nav, "Risk category");
      expect(p).toBeDefined();
      expect(p!.priority).toBe("high");
    });

    it("adds moderate priority for MODERATE risk category", () => {
      const nav = generateAttentionNavigator({ riskCategory: "MODERATE" });
      const p = getPriorityByLabel(nav, "Risk category");
      expect(p).toBeDefined();
      expect(p!.priority).toBe("moderate");
    });

    it("adds no risk category item for LOW", () => {
      const nav = generateAttentionNavigator({ riskCategory: "LOW" });
      const p = getPriorityByLabel(nav, "Risk category");
      expect(p).toBeUndefined();
    });

    it("is case insensitive", () => {
      const nav = generateAttentionNavigator({ riskCategory: "high" });
      const p = getPriorityByLabel(nav, "Risk category");
      expect(p).toBeDefined();
      expect(p!.priority).toBe("high");
    });
  });

  describe("HbA1c thresholds", () => {
    it("returns high priority for HbA1c >= 9", () => {
      const nav = generateAttentionNavigator({ hba1cLevel: 9 });
      const p = getPriorityByLabel(nav, "HbA1c");
      expect(p!.priority).toBe("high");
    });

    it("returns high priority for HbA1c >= 10", () => {
      const nav = generateAttentionNavigator({ hba1cLevel: 10 });
      const p = getPriorityByLabel(nav, "HbA1c");
      expect(p!.priority).toBe("high");
    });

    it("returns moderate priority for HbA1c >= 7 and < 9", () => {
      const nav = generateAttentionNavigator({ hba1cLevel: 7.5 });
      const p = getPriorityByLabel(nav, "HbA1c");
      expect(p!.priority).toBe("moderate");
    });

    it("returns moderate priority for HbA1c = 7", () => {
      const nav = generateAttentionNavigator({ hba1cLevel: 7 });
      const p = getPriorityByLabel(nav, "HbA1c");
      expect(p!.priority).toBe("moderate");
    });

    it("returns monitor priority for HbA1c < 7", () => {
      const nav = generateAttentionNavigator({ hba1cLevel: 6.5 });
      const p = getPriorityByLabel(nav, "HbA1c");
      expect(p!.priority).toBe("monitor");
    });

    it("does not add HbA1c item when undefined", () => {
      const nav = generateAttentionNavigator({});
      const p = getPriorityByLabel(nav, "HbA1c");
      expect(p).toBeUndefined();
    });
  });

  describe("blood glucose thresholds", () => {
    it("returns high priority for blood glucose >= 200", () => {
      const nav = generateAttentionNavigator({ bloodGlucoseLevel: 200 });
      const p = getPriorityByLabel(nav, "Blood Glucose");
      expect(p!.priority).toBe("high");
    });

    it("returns moderate priority for blood glucose >= 140 and < 200", () => {
      const nav = generateAttentionNavigator({ bloodGlucoseLevel: 160 });
      const p = getPriorityByLabel(nav, "Blood Glucose");
      expect(p!.priority).toBe("moderate");
    });

    it("returns monitor priority for blood glucose < 140", () => {
      const nav = generateAttentionNavigator({ bloodGlucoseLevel: 120 });
      const p = getPriorityByLabel(nav, "Blood Glucose");
      expect(p!.priority).toBe("monitor");
    });
  });

  describe("BMI thresholds", () => {
    it("returns moderate priority for BMI >= 30", () => {
      const nav = generateAttentionNavigator({ bmi: 30 });
      const p = getPriorityByLabel(nav, "BMI");
      expect(p!.priority).toBe("moderate");
    });

    it("returns monitor priority for BMI >= 25 and < 30", () => {
      const nav = generateAttentionNavigator({ bmi: 27 });
      const p = getPriorityByLabel(nav, "BMI");
      expect(p!.priority).toBe("monitor");
    });

    it("returns monitor priority for BMI < 25 (normal BMI still tracked as monitor)", () => {
      const nav = generateAttentionNavigator({ bmi: 22 });
      const p = getPriorityByLabel(nav, "BMI");
      // Note: implementation returns 'monitor' for all BMI < 30
      expect(p!.priority).toBe("monitor");
    });
  });

  describe("hypertension", () => {
    it("adds moderate priority when hypertension is true", () => {
      const nav = generateAttentionNavigator({ hypertension: true });
      const p = getPriorityByLabel(nav, "Hypertension");
      expect(p).toBeDefined();
      expect(p!.priority).toBe("moderate");
    });

    it("does not add priority when hypertension is false", () => {
      const nav = generateAttentionNavigator({ hypertension: false });
      const p = getPriorityByLabel(nav, "Hypertension");
      expect(p).toBeUndefined();
    });
  });

  describe("heart disease", () => {
    it("adds high priority when heartDisease is true", () => {
      const nav = generateAttentionNavigator({ heartDisease: true });
      const p = getPriorityByLabel(nav, "Heart Disease");
      expect(p).toBeDefined();
      expect(p!.priority).toBe("high");
    });

    it("does not add priority when heartDisease is false", () => {
      const nav = generateAttentionNavigator({ heartDisease: false });
      const p = getPriorityByLabel(nav, "Heart Disease");
      expect(p).toBeUndefined();
    });
  });

  describe("smoking history normalization", () => {
    it('maps "current" to moderate priority', () => {
      const nav = generateAttentionNavigator({ smokingHistory: "current" });
      const p = getPriorityByLabel(nav, "Smoking History");
      expect(p!.priority).toBe("moderate");
    });

    it('maps "former" to monitor priority', () => {
      const nav = generateAttentionNavigator({ smokingHistory: "former" });
      const p = getPriorityByLabel(nav, "Smoking History");
      expect(p!.priority).toBe("monitor");
    });

    it('maps "never" to no priority item', () => {
      const nav = generateAttentionNavigator({ smokingHistory: "never" });
      const p = getPriorityByLabel(nav, "Smoking History");
      expect(p).toBeUndefined();
    });

    it("is case insensitive", () => {
      const nav = generateAttentionNavigator({ smokingHistory: "CURRENT" });
      const p = getPriorityByLabel(nav, "Smoking History");
      expect(p!.priority).toBe("moderate");
    });
  });

  describe("de-duplication", () => {
    it("only keeps one entry per factor", () => {
      // Both hba1cLevel and factors array might trigger same factor
      const nav = generateAttentionNavigator({
        hba1cLevel: 9,
        factors: [
          { name: "HbA1c", impact: "negative", description: "High HbA1c" },
        ],
      });
      const hbA1cItems = nav.priorities.filter((p) => p.factor === "HbA1c");
      expect(hbA1cItems.length).toBeLessThanOrEqual(1);
    });

    it("high priority wins over moderate for same factor", () => {
      const nav = generateAttentionNavigator({
        hba1cLevel: 9, // high
        factors: [{ name: "HbA1c", impact: "negative", description: "elevated" }],
      });
      const p = getPriorityByLabel(nav, "HbA1c");
      expect(p!.priority).toBe("high");
    });
  });

  describe("ordering", () => {
    it("high priority items come before moderate", () => {
      const nav = generateAttentionNavigator({
        riskCategory: "HIGH",
        hba1cLevel: 7.5,
      });
      const highIdx = nav.priorities.findIndex((p) => p.priority === "high");
      const modIdx = nav.priorities.findIndex((p) => p.priority === "moderate");
      expect(highIdx).toBeLessThan(modIdx);
    });

    it("moderate priority items come before monitor", () => {
      const nav = generateAttentionNavigator({
        hba1cLevel: 7.5, // moderate
        bmi: 22, // monitor
      });
      const modIdx = nav.priorities.findIndex((p) => p.priority === "moderate");
      const monIdx = nav.priorities.findIndex((p) => p.priority === "monitor");
      expect(modIdx).toBeLessThan(monIdx);
    });
  });

  describe("empty input", () => {
    it("returns empty priorities for empty input", () => {
      const nav = generateAttentionNavigator({});
      expect(nav.priorities).toEqual([]);
    });
  });
});
