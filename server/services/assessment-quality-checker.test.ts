import { describe, it, expect } from "vitest";
import { generateQualityAlerts } from "./assessment-quality-checker";

describe("generateQualityAlerts", () => {
  it("returns empty array when all values are normal", () => {
    const result = generateQualityAlerts({
      hba1cLevel: 5.5,
      bloodGlucoseLevel: 100,
      bmi: 24,
      age: 45,
      heartDisease: false,
    });
    expect(result).toHaveLength(0);
  });

  describe("isLikelyUnitError", () => {
    it("triggers warning when HbA1c > 20", () => {
      const result = generateQualityAlerts({ hba1cLevel: 25 });
      const unitAlert = result.find((a) => a.code === "UNIT_HBA1C_HIGH");
      expect(unitAlert).toBeDefined();
      expect(unitAlert!.severity).toBe("warning");
    });

    it("triggers warning when blood glucose < 20", () => {
      const result = generateQualityAlerts({ bloodGlucoseLevel: 10 });
      const unitAlert = result.find((a) => a.code === "UNIT_GLUCOSE_LOW");
      expect(unitAlert).toBeDefined();
      expect(unitAlert!.severity).toBe("warning");
    });

    it("does not trigger when HbA1c is in normal range", () => {
      const result = generateQualityAlerts({ hba1cLevel: 7.0 });
      const alerts = result.filter((a) => a.code === "UNIT_HBA1C_HIGH");
      expect(alerts).toHaveLength(0);
    });

    it("does not trigger when blood glucose is in normal range", () => {
      const result = generateQualityAlerts({ bloodGlucoseLevel: 100 });
      const alerts = result.filter((a) => a.code === "UNIT_GLUCOSE_LOW");
      expect(alerts).toHaveLength(0);
    });

    it("does not trigger when blood glucose is exactly 20", () => {
      const result = generateQualityAlerts({ bloodGlucoseLevel: 20 });
      const alerts = result.filter((a) => a.code === "UNIT_GLUCOSE_LOW");
      expect(alerts).toHaveLength(0);
    });
  });

  describe("bmiHbA1cMismatch", () => {
    it("triggers warning when BMI < 18.5 and HbA1c >= 9", () => {
      const result = generateQualityAlerts({ bmi: 16, hba1cLevel: 10 });
      const mismatchAlert = result.find((a) => a.code === "LOWBMI_HIGHHBA1C");
      expect(mismatchAlert).toBeDefined();
      expect(mismatchAlert!.severity).toBe("warning");
    });

    it("does not trigger when BMI is normal", () => {
      const result = generateQualityAlerts({ bmi: 22, hba1cLevel: 10 });
      const alerts = result.filter((a) => a.code === "LOWBMI_HIGHHBA1C");
      expect(alerts).toHaveLength(0);
    });

    it("triggers info when fasting glucose is normal but HbA1c is very high", () => {
      const result = generateQualityAlerts({ bloodGlucoseLevel: 100, hba1cLevel: 10 });
      const mismatchAlert = result.find((a) => a.code === "NORMALGLUCOSE_HIGHHBA1C");
      expect(mismatchAlert).toBeDefined();
      expect(mismatchAlert!.severity).toBe("info");
    });

    it("does not trigger NORMALGLUCOSE_HIGHHBA1C when glucose is out of normal range", () => {
      const result = generateQualityAlerts({ bloodGlucoseLevel: 200, hba1cLevel: 10 });
      const alerts = result.filter((a) => a.code === "NORMALGLUCOSE_HIGHHBA1C");
      expect(alerts).toHaveLength(0);
    });
  });

  describe("youngAgeWithHeartDisease", () => {
    it("triggers warning when age < 40 and heartDisease is true", () => {
      const result = generateQualityAlerts({ age: 35, heartDisease: true });
      const youngHeartAlert = result.find((a) => a.code === "YOUNG_HEART_DISEASE");
      expect(youngHeartAlert).toBeDefined();
      expect(youngHeartAlert!.severity).toBe("warning");
    });

    it("does not trigger when age is 40 or above", () => {
      const result = generateQualityAlerts({ age: 40, heartDisease: true });
      const alerts = result.filter((a) => a.code === "YOUNG_HEART_DISEASE");
      expect(alerts).toHaveLength(0);
    });

    it("does not trigger when heartDisease is false regardless of age", () => {
      const result = generateQualityAlerts({ age: 20, heartDisease: false });
      const alerts = result.filter((a) => a.code === "YOUNG_HEART_DISEASE");
      expect(alerts).toHaveLength(0);
    });
  });

  describe("extremeCombinationChecks", () => {
    it("triggers warning when HbA1c >= 14 and blood glucose >= 300", () => {
      const result = generateQualityAlerts({ hba1cLevel: 15, bloodGlucoseLevel: 350 });
      const extremeAlert = result.find((a) => a.code === "EXTREME_HYPERGLYCAEMIA");
      expect(extremeAlert).toBeDefined();
      expect(extremeAlert!.severity).toBe("warning");
    });

    it("does not trigger EXTREME_HYPERGLYCAEMIA when only one threshold is met", () => {
      const result1 = generateQualityAlerts({ hba1cLevel: 15, bloodGlucoseLevel: 200 });
      expect(result1.filter((a) => a.code === "EXTREME_HYPERGLYCAEMIA")).toHaveLength(0);

      const result2 = generateQualityAlerts({ hba1cLevel: 10, bloodGlucoseLevel: 350 });
      expect(result2.filter((a) => a.code === "EXTREME_HYPERGLYCAEMIA")).toHaveLength(0);
    });

    it("triggers info when BMI < 15 and blood glucose < 50", () => {
      const result = generateQualityAlerts({ bmi: 14, bloodGlucoseLevel: 40 });
      const alert = result.find((a) => a.code === "VERY_LOW_BMI_LOW_GLUCOSE");
      expect(alert).toBeDefined();
      expect(alert!.severity).toBe("info");
    });

    it("does not trigger VERY_LOW_BMI_LOW_GLUCOSE when only one condition is met", () => {
      const result1 = generateQualityAlerts({ bmi: 14, bloodGlucoseLevel: 100 });
      expect(result1.filter((a) => a.code === "VERY_LOW_BMI_LOW_GLUCOSE")).toHaveLength(0);

      const result2 = generateQualityAlerts({ bmi: 25, bloodGlucoseLevel: 40 });
      expect(result2.filter((a) => a.code === "VERY_LOW_BMI_LOW_GLUCOSE")).toHaveLength(0);
    });
  });

  describe("deduplication", () => {
    it("does not return duplicate alerts with same code and message", () => {
      // Trigger the same check multiple times with same values
      const result = generateQualityAlerts({ hba1cLevel: 25 });
      const unitAlerts = result.filter((a) => a.code === "UNIT_HBA1C_HIGH");
      expect(unitAlerts).toHaveLength(1);
    });

    it("returns multiple different alerts without deduplication", () => {
      const result = generateQualityAlerts({
        hba1cLevel: 25,
        bloodGlucoseLevel: 10,
      });
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("handles missing optional fields gracefully", () => {
    const result = generateQualityAlerts({});
    // No error thrown; returns empty or valid alerts
    expect(Array.isArray(result)).toBe(true);
  });

  it("handles NaN values gracefully (treated as missing)", () => {
    const result = generateQualityAlerts({
      hba1cLevel: NaN,
      bloodGlucoseLevel: NaN,
      bmi: NaN,
      age: NaN,
    });
    // No error thrown; NaN treated as missing
    expect(Array.isArray(result)).toBe(true);
  });
});
