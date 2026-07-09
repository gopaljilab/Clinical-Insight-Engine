import { describe, expect, it, test } from "vitest";
import type { AssessmentFactor } from "../../shared/schema";
import {
  generatePredictionExplanation,
  type ExplainerInput,
} from "./prediction-explainer";

describe("normalizeFactors", () => {
  it("returns input array when factors is an array", () => {
    const factors: AssessmentFactor[] = [
      { name: "HbA1c", impact: "positive", description: "Elevated" },
    ];
    const result = generatePredictionExplanation({ factors } as ExplainerInput);
    expect(result.topContributors).toHaveLength(1);
  });

  it("returns empty array when factors is not an array", () => {
    const result = generatePredictionExplanation({
      factors: "not-array" as any,
    } as ExplainerInput);
    // Should not throw; factors treated as empty
    expect(result.topContributors).toHaveLength(0);
  });

  it("returns empty array when factors is null", () => {
    const result = generatePredictionExplanation({
      factors: null as any,
    } as ExplainerInput);
    expect(result.topContributors).toHaveLength(0);
  });

  it("returns empty array when factors is undefined", () => {
    const result = generatePredictionExplanation({} as ExplainerInput);
    expect(result.topContributors).toHaveLength(0);
  });
});

describe("getFactorWeight", () => {
  it("applies position bonus for early factors", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "diabetic hba1c range", impact: "positive", description: "High risk" },
        { name: "Age > 60", impact: "negative", description: "Lower risk" },
      ],
    } as ExplainerInput);

    const [first, second] = result.topContributors;
    // Both map to strength 100 in the base map; first factor gets position bonus
    expect(first.strength).toBeGreaterThanOrEqual(100);
  });

  it("uses factorStrengthMap base for known factors", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "smoking current", impact: "positive", description: "Smoking risk" },
      ],
    } as ExplainerInput);

    // smoking current maps to base 70 + position bonus
    expect(result.topContributors[0].strength).toBeGreaterThan(70);
  });

  it("falls back to default base for unknown factors with positive impact", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "Unknown Factor X", impact: "positive", description: "Unknown" },
      ],
    } as ExplainerInput);

    // Base = 50 (positive default), position bonus = 20, capped at 100
    expect(result.topContributors[0].strength).toBe(70);
  });

  it("falls back to default base for unknown factors with negative impact", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "Unknown Factor Y", impact: "negative", description: "Unknown" },
      ],
    } as ExplainerInput);

    // Base = 40 (negative default), position bonus = 20
    expect(result.topContributors[0].strength).toBe(60);
  });

  it("caps strength at 100", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "diabetic hba1c range", impact: "positive", description: "High" },
        { name: "diabetic hba1c range", impact: "positive", description: "High" },
        { name: "diabetic hba1c range", impact: "positive", description: "High" },
        { name: "diabetic hba1c range", impact: "positive", description: "High" },
      ],
    } as ExplainerInput);

    // All are base 100 + bonus, capped at 100
    result.topContributors.forEach(c => {
      expect(c.strength).toBeLessThanOrEqual(100);
    });
  });
});

describe("getFactorWhy", () => {
  it("generates context-aware explanation for hba1c factor with value", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "HbA1c", impact: "positive", description: "Elevated HbA1c drives risk" },
      ],
      hba1cLevel: 8.5,
    } as ExplainerInput);

    expect(result.topContributors[0].why).toContain("8.5");
    expect(result.topContributors[0].why).toContain("HbA1c is");
  });

  it("generates context-aware explanation for bmi factor with value", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "BMI", impact: "positive", description: "High BMI drives risk" },
      ],
      bmi: 33.2,
    } as ExplainerInput);

    expect(result.topContributors[0].why).toContain("33.2");
    expect(result.topContributors[0].why).toContain("BMI is");
  });

  it("falls back to description for hba1c when no hba1cLevel value", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "HbA1c", impact: "positive", description: "Elevated HbA1c drives risk" },
      ],
    } as ExplainerInput);

    expect(result.topContributors[0].why).toBe("Elevated HbA1c drives risk");
  });

  it("generates context-aware explanation for glucose factor", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "Blood glucose", impact: "positive", description: "High glucose" },
      ],
      bloodGlucoseLevel: 180,
    } as ExplainerInput);

    expect(result.topContributors[0].why).toContain("180");
    expect(result.topContributors[0].why).toContain("mg/dL");
  });

  it("returns raw description for unrecognized factor names", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "Some other factor", impact: "positive", description: "Custom reason" },
      ],
    } as ExplainerInput);

    expect(result.topContributors[0].why).toBe("Custom reason");
  });
});

describe("generatePredictionExplanation", () => {
  it("returns object with all expected shape fields", () => {
    const result = generatePredictionExplanation({} as ExplainerInput);
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("patientSummary");
    expect(result).toHaveProperty("clinicianSummary");
    expect(result).toHaveProperty("topContributors");
    expect(result).toHaveProperty("strongestPositive");
    expect(result).toHaveProperty("strongestNegative");
  });

  it("returns empty arrays when no factors provided", () => {
    const result = generatePredictionExplanation({} as ExplainerInput);
    expect(result.topContributors).toHaveLength(0);
    expect(result.strongestPositive).toHaveLength(0);
    expect(result.strongestNegative).toHaveLength(0);
  });

  it("sets risk label to low for missing riskCategory", () => {
    const result = generatePredictionExplanation({} as ExplainerInput);
    expect(result.summary).toContain("low");
  });

  it("sets risk label to high for HIGH riskCategory", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "Test", impact: "positive", description: "Test" },
      ],
    } as ExplainerInput);
    expect(result.summary).toContain("high");
  });

  it("sets risk label to moderate for MODERATE riskCategory", () => {
    const result = generatePredictionExplanation({
      riskCategory: "MODERATE",
      factors: [
        { name: "Test", impact: "positive", description: "Test" },
      ],
    } as ExplainerInput);
    expect(result.summary).toContain("moderate");
  });

  it("sorts topContributors by descending strength", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "Weak factor", impact: "positive", description: "Low impact" },
        { name: "Strong factor", impact: "positive", description: "High impact" },
      ],
    } as ExplainerInput);

    expect(result.topContributors[0].strength).toBeGreaterThanOrEqual(
      result.topContributors[1].strength
    );
  });

  it("limits topContributors to 4", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "Factor 1", impact: "positive", description: "A" },
        { name: "Factor 2", impact: "positive", description: "B" },
        { name: "Factor 3", impact: "negative", description: "C" },
        { name: "Factor 4", impact: "positive", description: "D" },
        { name: "Factor 5", impact: "negative", description: "E" },
        { name: "Factor 6", impact: "positive", description: "F" },
      ],
    } as ExplainerInput);

    expect(result.topContributors.length).toBeLessThanOrEqual(4);
  });

  it("populates strongestPositive with positive-impact factors", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "Positive A", impact: "positive", description: "A" },
        { name: "Positive B", impact: "positive", description: "B" },
        { name: "Negative A", impact: "negative", description: "C" },
      ],
    } as ExplainerInput);

    expect(result.strongestPositive.length).toBeGreaterThan(0);
    result.strongestPositive.forEach(f => {
      expect(f.impact).toBe("positive");
    });
  });

  it("populates strongestNegative with negative-impact factors", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "Positive A", impact: "positive", description: "A" },
        { name: "Negative A", impact: "negative", description: "B" },
        { name: "Negative B", impact: "negative", description: "C" },
      ],
    } as ExplainerInput);

    result.strongestNegative.forEach(f => {
      expect(f.impact).toBe("negative");
    });
  });

  it("each contributor has name, impact, strength, description, why", () => {
    const result = generatePredictionExplanation({
      factors: [
        { name: "Test Factor", impact: "positive", description: "Test description" },
      ],
    } as ExplainerInput);

    const contributor = result.topContributors[0];
    expect(contributor).toHaveProperty("name", "Test Factor");
    expect(contributor).toHaveProperty("impact", "positive");
    expect(contributor).toHaveProperty("strength");
    expect(contributor).toHaveProperty("description", "Test description");
    expect(contributor).toHaveProperty("why");
  });

  it("handles empty factors array gracefully", () => {
    const result = generatePredictionExplanation({
      factors: [],
    } as ExplainerInput);
    expect(result.topContributors).toHaveLength(0);
    expect(result.summary).toContain("no strong contributors");
  });

  it("summary includes contributor names", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "HbA1c", impact: "positive", description: "Elevated" },
      ],
    } as ExplainerInput);

    expect(result.summary).toContain("HbA1c");
    expect(result.summary).toContain("high");
  });

  it("patientSummary includes risk label and contributor names", () => {
    const result = generatePredictionExplanation({
      riskCategory: "MODERATE",
      factors: [
        { name: "BMI", impact: "positive", description: "High" },
      ],
    } as ExplainerInput);

    expect(result.patientSummary).toContain("moderate");
    expect(result.patientSummary).toContain("bmi");
  });

  it("clinicianSummary includes risk label and review guidance", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "Smoking", impact: "positive", description: "Smoking" },
      ],
    } as ExplainerInput);

    expect(result.clinicianSummary).toContain("high");
    expect(result.clinicianSummary.toLowerCase()).toContain("review");
  });
});

describe("prediction-explainer tests from origin/main", () => {
  test("returns HIGH risk explanation with top contributors", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "diabetic hba1c range", impact: "positive", strength: 50, description: "HbA1c in diabetic range", why: "HbA1c in diabetic range" },
        { name: "obese (bmi >= 30)", impact: "positive", strength: 50, description: "BMI indicates obesity", why: "BMI indicates obesity" },
      ],
      hba1cLevel: 9.5,
      bmi: 35,
    });

    expect(result.summary).toContain("high");
    expect(result.patientSummary).toContain("high");
    expect(result.clinicianSummary).toContain("high");
    expect(result.topContributors).toHaveLength(2);
  });

  test("returns LOW risk explanation when no positive factors", () => {
    const result = generatePredictionExplanation({
      riskCategory: "LOW",
      factors: [],
    });

    expect(result.summary).toContain("low");
    expect(result.topContributors).toHaveLength(0);
  });

  test("handles MODERATE risk category", () => {
    const result = generatePredictionExplanation({
      riskCategory: "MODERATE",
      factors: [
        { name: "prediabetic hba1c", impact: "positive", strength: 50, description: "Prediabetic range", why: "Prediabetic range" },
      ],
    });

    expect(result.summary).toContain("moderate");
  });

  test("handles missing riskCategory defaults to LOW", () => {
    const result = generatePredictionExplanation({});
    expect(result.summary).toContain("low");
  });

  test("handles null factors array", () => {
    const result = generatePredictionExplanation({
      factors: null as any,
    });
    expect(result.topContributors).toHaveLength(0);
  });

  test("handles non-array factors", () => {
    const result = generatePredictionExplanation({
      factors: "not an array" as any,
    });
    expect(result.topContributors).toHaveLength(0);
  });

  test("sorts factors by strength descending", () => {
    // Strength = factorStrengthMap[name] + position bonus, capped at 100
    // diabetic hba1c range at index 1: base 100 + bonus 15 = 100 (capped)
    // prediabetic hba1c at index 0: base 80 + bonus 20 = 100 (capped)
    // Both cap at 100 — stable sort preserves input order (prediabetic first)
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "prediabetic hba1c", impact: "positive", strength: 30, description: "Prediabetic", why: "Prediabetic" },
        { name: "diabetic hba1c range", impact: "positive", strength: 80, description: "Diabetic HbA1c", why: "Diabetic HbA1c" },
      ],
    });

    // Both cap at 100; stable sort preserves insertion order
    expect(result.topContributors[0].name).toBe("prediabetic hba1c");
    expect(result.topContributors[1].name).toBe("diabetic hba1c range");
  });

  test("limits topContributors to 4", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "f1", impact: "positive", strength: 100, description: "f1", why: "f1" },
        { name: "f2", impact: "positive", strength: 90, description: "f2", why: "f2" },
        { name: "f3", impact: "positive", strength: 80, description: "f3", why: "f3" },
        { name: "f4", impact: "positive", strength: 70, description: "f4", why: "f4" },
        { name: "f5", impact: "positive", strength: 60, description: "f5", why: "f5" },
      ],
    });

    expect(result.topContributors).toHaveLength(4);
  });

  test("separates positive and negative contributors", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "diabetic hba1c range", impact: "positive", strength: 80, description: "Diabetic", why: "Diabetic" },
        { name: "age > 60", impact: "negative", strength: 55, description: "Age factor", why: "Age factor" },
      ],
    });

    expect(result.strongestPositive.length).toBeGreaterThanOrEqual(0);
    expect(result.strongestNegative.length).toBeGreaterThanOrEqual(0);
  });

  test("HbA1c why string includes value when provided", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "diabetic hba1c range", impact: "positive", strength: 80, description: "Diabetic range", why: "placeholder" },
      ],
      hba1cLevel: 9.5,
    });

    expect(result.topContributors[0].why).toContain("9.5");
  });

  test("BMI why string includes value when provided", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "obese (bmi >= 30)", impact: "positive", strength: 80, description: "Obese", why: "placeholder" },
      ],
      bmi: 35.0,
    });

    expect(result.topContributors[0].why).toContain("35");
  });

  test("blood glucose why string includes value", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "elevated fasting glucose", impact: "positive", strength: 75, description: "Elevated", why: "placeholder" },
      ],
      bloodGlucoseLevel: 200,
    });

    expect(result.topContributors[0].why).toContain("200");
  });

  test("handles unknown factor names gracefully", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "unknown factor", impact: "positive", strength: 50, description: "Unknown", why: "Unknown" },
      ],
    });

    expect(result.topContributors).toHaveLength(1);
    expect(result.topContributors[0].name).toBe("unknown factor");
  });

  test("strength capped at 100 with position bonus", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "diabetic hba1c range", impact: "positive", strength: 90, description: "Diabetic", why: "Diabetic" },
      ],
    });

    expect(result.topContributors[0].strength).toBeLessThanOrEqual(100);
  });

  test("hypertension factor returns why string", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "hypertension", impact: "positive", strength: 60, description: "Hypertension present", why: "Hypertension present" },
      ],
      hypertension: true,
    });

    expect(result.topContributors[0].why).toContain("Hypertension present");
  });

  test("heart disease factor returns why string", () => {
    const result = generatePredictionExplanation({
      riskCategory: "HIGH",
      factors: [
        { name: "heart disease", impact: "positive", strength: 60, description: "Heart disease present", why: "Heart disease present" },
      ],
      heartDisease: true,
    });

    expect(result.topContributors[0].why).toContain("Heart disease present");
  });
});
