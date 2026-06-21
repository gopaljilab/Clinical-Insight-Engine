import { describe, expect, it } from "vitest";
import { calculateClinicalFallback } from "./services/mlService";

describe("calculateClinicalFallback golden scenarios", () => {
  it("keeps a stable low-risk profile in the low category", () => {
    const prediction = calculateClinicalFallback({
      age: 32,
      bmi: 22.4,
      hba1cLevel: 5.2,
      bloodGlucoseLevel: 91,
      hypertension: false,
      heartDisease: false,
    });

    expect(prediction.riskCategory).toBe("LOW");
    expect(prediction.riskScore).toBe(1);
    expect(prediction.factors).toContainEqual(
      expect.objectContaining({ name: "Stable Profile", impact: "negative" }),
    );
  });

  it("identifies a moderate prediabetes scenario", () => {
    const prediction = calculateClinicalFallback({
      age: 48,
      bmi: 23.2,
      hba1cLevel: 5.9,
      bloodGlucoseLevel: 91,
      hypertension: false,
      heartDisease: false,
    });

    expect(prediction.riskCategory).toBe("MODERATE");
    expect(prediction.riskScore).toBe(30);
    expect(prediction.factors.map((factor: { name: string }) => factor.name)).toEqual(
      expect.arrayContaining([
        "Age > 45",
        "Prediabetic HbA1c",
      ]),
    );
  });

  it("identifies a high-risk metabolic profile", () => {
    const prediction = calculateClinicalFallback({
      age: 67,
      bmi: 33.1,
      hba1cLevel: 7.2,
      bloodGlucoseLevel: 142,
      hypertension: true,
      heartDisease: true,
    });

    expect(prediction.riskCategory).toBe("HIGH");
    expect(prediction.riskScore).toBe(99);
    expect(prediction.clinicianAdvice[0]).toContain("High risk");
    expect(prediction.confidenceInterval).toBe("94% - 99%");
  });
});
