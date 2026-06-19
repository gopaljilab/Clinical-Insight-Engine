import { expect, test, describe } from "vitest";
import { generateQualityAlerts } from "./assessment-quality-checker";

describe("assessment-quality-checker", () => {
  test("returns no alerts for normal values", () => {
    const alerts = generateQualityAlerts({
      hba1cLevel: "5.5" as any,
      bloodGlucoseLevel: "100" as any,
      bmi: "25" as any,
      age: 45,
      heartDisease: false,
    });
    expect(alerts).toHaveLength(0);
  });

  test("detects HbA1c unit errors (likely mmol/mol instead of %)", () => {
    const alerts = generateQualityAlerts({
      hba1cLevel: "45" as any, // normal is < 6.5
    });
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "UNIT_HBA1C_HIGH" }),
      ])
    );
  });

  test("detects BMI and HbA1c mismatch", () => {
    const alerts = generateQualityAlerts({
      bmi: "17" as any,
      hba1cLevel: "10" as any,
    });
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "LOWBMI_HIGHHBA1C" }),
      ])
    );
  });

  test("detects very young patients with reported heart disease", () => {
    const alerts = generateQualityAlerts({
      age: 30,
      heartDisease: true,
    });
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "YOUNG_HEART_DISEASE" }),
      ])
    );
  });

  test("detects extreme hyperglycemia", () => {
    const alerts = generateQualityAlerts({
      hba1cLevel: "15" as any,
      bloodGlucoseLevel: "350" as any,
    });
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "EXTREME_HYPERGLYCAEMIA" }),
      ])
    );
  });
});
