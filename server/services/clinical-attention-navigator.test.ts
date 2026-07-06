import { describe, it, expect } from "vitest";
import {
  generateAttentionNavigator,
  type NavigatorInput,
} from "./clinical-attention-navigator";

describe("normalizeSmoking (via generateAttentionNavigator integration)", () => {
  it("maps smoking value containing 'current' to current", () => {
    const result = generateAttentionNavigator({
      smokingHistory: "Current Smoker",
    } as NavigatorInput);
    expect(result.priorities).toBeDefined();
    const smoking = result.priorities.find(p => p.factor === "Smoking History");
    expect(smoking?.priority).toBe("moderate"); // current smoking -> moderate
  });

  it("maps smoking value containing 'former' to former", () => {
    const result = generateAttentionNavigator({
      smokingHistory: "Former Smoker",
    } as NavigatorInput);
    const smoking = result.priorities.find(p => p.factor === "Smoking History");
    expect(smoking?.priority).toBe("monitor"); // former smoking -> monitor
  });

  it("maps smoking value containing 'never' to never", () => {
    const result = generateAttentionNavigator({
      smokingHistory: "Never Smoked",
    } as NavigatorInput);
    const smoking = result.priorities.find(p => p.factor === "Smoking History");
    expect(smoking).toBeUndefined(); // never smoking -> no priority entry
  });

  it("defaults to unknown for unrecognized smoking values", () => {
    const result = generateAttentionNavigator({
      smokingHistory: "occasional",
    } as NavigatorInput);
    const smoking = result.priorities.find(p => p.factor === "Smoking History");
    expect(smoking).toBeUndefined(); // unknown -> no priority entry
  });
});

describe("admissionPriority thresholds (via generateAttentionNavigator)", () => {
  it("flags HbA1c above 9 as high priority", () => {
    const result = generateAttentionNavigator({
      hba1cLevel: 10.5,
    } as NavigatorInput);
    const hba1c = result.priorities.find(p => p.factor === "HbA1c");
    expect(hba1c?.priority).toBe("high");
    expect(hba1c?.value).toBe(10.5);
  });

  it("flags HbA1c between 7 and 9 as moderate priority", () => {
    const result = generateAttentionNavigator({
      hba1cLevel: 8.0,
    } as NavigatorInput);
    const hba1c = result.priorities.find(p => p.factor === "HbA1c");
    expect(hba1c?.priority).toBe("moderate");
  });

  it("flags HbA1c below 7 as monitor priority", () => {
    const result = generateAttentionNavigator({
      hba1cLevel: 5.5,
    } as NavigatorInput);
    const hba1c = result.priorities.find(p => p.factor === "HbA1c");
    expect(hba1c?.priority).toBe("monitor");
  });

  it("flags blood glucose above 200 as high priority", () => {
    const result = generateAttentionNavigator({
      bloodGlucoseLevel: 250,
    } as NavigatorInput);
    const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
    expect(glucose?.priority).toBe("high");
  });

  it("flags blood glucose between 140 and 200 as moderate priority", () => {
    const result = generateAttentionNavigator({
      bloodGlucoseLevel: 160,
    } as NavigatorInput);
    const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
    expect(glucose?.priority).toBe("moderate");
  });

  it("flags blood glucose below 140 as monitor priority", () => {
    const result = generateAttentionNavigator({
      bloodGlucoseLevel: 100,
    } as NavigatorInput);
    const glucose = result.priorities.find(p => p.factor === "Blood Glucose");
    expect(glucose?.priority).toBe("monitor");
  });

  it("flags BMI above 30 as moderate priority", () => {
    const result = generateAttentionNavigator({
      bmi: 33,
    } as NavigatorInput);
    const bmi = result.priorities.find(p => p.factor === "BMI");
    expect(bmi?.priority).toBe("moderate");
  });

  it("flags BMI between 25 and 30 as monitor priority", () => {
    const result = generateAttentionNavigator({
      bmi: 27,
    } as NavigatorInput);
    const bmi = result.priorities.find(p => p.factor === "BMI");
    expect(bmi?.priority).toBe("monitor");
  });
});

describe("generateAttentionNavigator", () => {
  it("returns an object with priorities array", () => {
    const result = generateAttentionNavigator({} as NavigatorInput);
    expect(result).toHaveProperty("priorities");
    expect(Array.isArray(result.priorities)).toBe(true);
  });

  it("returns empty priorities for minimal input", () => {
    const result = generateAttentionNavigator({} as NavigatorInput);
    expect(result.priorities).toHaveLength(0);
  });

  it("sets HIGH riskCategory as high priority", () => {
    const result = generateAttentionNavigator({
      riskCategory: "HIGH",
    } as NavigatorInput);
    const risk = result.priorities.find(p => p.factor === "Risk category");
    expect(risk?.priority).toBe("high");
  });

  it("sets MODERATE riskCategory as moderate priority", () => {
    const result = generateAttentionNavigator({
      riskCategory: "MODERATE",
    } as NavigatorInput);
    const risk = result.priorities.find(p => p.factor === "Risk category");
    expect(risk?.priority).toBe("moderate");
  });

  it("sets LOW riskCategory as no entry (default case)", () => {
    const result = generateAttentionNavigator({
      riskCategory: "LOW",
    } as NavigatorInput);
    const risk = result.priorities.find(p => p.factor === "Risk category");
    expect(risk).toBeUndefined();
  });

  it("adds hypertension as moderate priority", () => {
    const result = generateAttentionNavigator({
      hypertension: true,
    } as NavigatorInput);
    const hypertension = result.priorities.find(p => p.factor === "Hypertension");
    expect(hypertension?.priority).toBe("moderate");
  });

  it("adds heart disease as high priority", () => {
    const result = generateAttentionNavigator({
      heartDisease: true,
    } as NavigatorInput);
    const heartDisease = result.priorities.find(p => p.factor === "Heart Disease");
    expect(heartDisease?.priority).toBe("high");
  });

  it("sorts priorities with high first, then moderate, then monitor", () => {
    const result = generateAttentionNavigator({
      riskCategory: "MODERATE",
      hypertension: true,
      heartDisease: true,
    } as NavigatorInput);
    const priorities = result.priorities.map(p => p.priority);
    const highIdx = priorities.indexOf("high");
    const moderateIdx = priorities.indexOf("moderate");
    expect(highIdx).toBeLessThan(moderateIdx);
  });

  it("handles null/undefined hba1c gracefully (does not add HbA1c entry)", () => {
    const result = generateAttentionNavigator({
      hba1cLevel: null as any,
    } as NavigatorInput);
    const hba1c = result.priorities.find(p => p.factor === "HbA1c");
    expect(hba1c).toBeUndefined();
  });

  it("handles NaN bmi gracefully", () => {
    const result = generateAttentionNavigator({
      bmi: NaN,
    } as NavigatorInput);
    const bmi = result.priorities.find(p => p.factor === "BMI");
    expect(bmi).toBeUndefined();
  });

  it("handles factors array with positive impact as high priority", () => {
    const result = generateAttentionNavigator({
      factors: [
        { name: "Test Factor", impact: "positive", description: "Increases risk" },
      ],
    } as NavigatorInput);
    const factor = result.priorities.find(p => p.factor === "Test Factor");
    expect(factor?.priority).toBe("high");
  });

  it("handles factors array with negative impact as monitor priority", () => {
    const result = generateAttentionNavigator({
      factors: [
        { name: "Test Factor", impact: "negative", description: "Decreases risk" },
      ],
    } as NavigatorInput);
    const factor = result.priorities.find(p => p.factor === "Test Factor");
    expect(factor?.priority).toBe("monitor");
  });

  it("limits factors output to top 3", () => {
    const result = generateAttentionNavigator({
      factors: [
        { name: "Factor 1", impact: "positive", description: "" },
        { name: "Factor 2", impact: "positive", description: "" },
        { name: "Factor 3", impact: "negative", description: "" },
        { name: "Factor 4", impact: "negative", description: "" },
        { name: "Factor 5", impact: "negative", description: "" },
      ],
    } as NavigatorInput);
    const factorEntries = result.priorities.filter(
      p => p.factor.startsWith("Factor ")
    );
    expect(factorEntries.length).toBeLessThanOrEqual(3);
  });

  it("handles empty factors array gracefully", () => {
    const result = generateAttentionNavigator({
      factors: [],
    } as NavigatorInput);
    expect(result.priorities).toBeDefined();
  });

  it("handles non-array factors gracefully", () => {
    const result = generateAttentionNavigator({
      factors: "not-an-array" as any,
    } as NavigatorInput);
    // Should not throw and should return valid result
    expect(result).toHaveProperty("priorities");
  });
});
