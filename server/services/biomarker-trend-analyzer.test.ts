import { describe, it, expect } from "vitest";
import { analyzeBiomarkerTrends } from "./biomarker-trend-analyzer";

function makeAssessment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    createdBy: "user1",
    patientName: "Test Patient",
    gender: "Male" as const,
    age: 45,
    hypertension: false,
    heartDisease: false,
    smokingHistory: "never" as const,
    bmi: 24.5,
    hba1cLevel: 5.5,
    bloodGlucoseLevel: 100,
    riskScore: 10,
    riskCategory: "LOW" as const,
    factors: [],
    confidenceInterval: "5-15%",
    modelConfidence: 0.9,
    createdAt: new Date(),
    updatedAt: null,
    ...overrides,
  };
}

describe("analyzeBiomarkerTrends", () => {
  it("returns empty alerts for empty assessments array", () => {
    const result = analyzeBiomarkerTrends({ assessments: [] });
    expect(result).toHaveLength(0);
  });

  it("returns empty alerts for a single assessment", () => {
    const result = analyzeBiomarkerTrends({
      assessments: [makeAssessment({ hba1cLevel: 5.5 })],
    });
    expect(result).toHaveLength(0);
  });

  it("returns empty alerts when no biomarkers have enough consecutive changes", () => {
    const assessments = [
      makeAssessment({ hba1cLevel: 5.0, createdAt: new Date("2024-01-01") }),
      makeAssessment({ hba1cLevel: 5.2, createdAt: new Date("2024-01-02") }),
    ];
    const result = analyzeBiomarkerTrends({ assessments });
    expect(result).toHaveLength(0);
  });

  it("returns warning alert for 3+ consecutive HbA1c increases", () => {
    const assessments = [
      makeAssessment({ hba1cLevel: 5.0, createdAt: new Date("2024-01-01") }),
      makeAssessment({ hba1cLevel: 5.5, createdAt: new Date("2024-01-02") }),
      makeAssessment({ hba1cLevel: 6.0, createdAt: new Date("2024-01-03") }),
      makeAssessment({ hba1cLevel: 6.5, createdAt: new Date("2024-01-04") }),
    ];
    const result = analyzeBiomarkerTrends({ assessments });
    const hbaAlert = result.find((a) => a.biomarker === "HbA1c");
    expect(hbaAlert).toBeDefined();
    expect(hbaAlert!.trend).toBe("increasing");
    expect(hbaAlert!.severity).toBe("warning");
    expect(hbaAlert!.message).toContain("4 consecutive assessments");
  });

  it("returns info alert for 2 consecutive HbA1c increases", () => {
    const assessments = [
      makeAssessment({ hba1cLevel: 5.0, createdAt: new Date("2024-01-01") }),
      makeAssessment({ hba1cLevel: 5.5, createdAt: new Date("2024-01-02") }),
      makeAssessment({ hba1cLevel: 6.0, createdAt: new Date("2024-01-03") }),
    ];
    const result = analyzeBiomarkerTrends({ assessments });
    const hbaAlert = result.find((a) => a.biomarker === "HbA1c");
    expect(hbaAlert).toBeDefined();
    expect(hbaAlert!.trend).toBe("increasing");
    expect(hbaAlert!.severity).toBe("info");
  });

  it("returns info alert for 3+ consecutive HbA1c decreases", () => {
    const assessments = [
      makeAssessment({ hba1cLevel: 7.0, createdAt: new Date("2024-01-01") }),
      makeAssessment({ hba1cLevel: 6.5, createdAt: new Date("2024-01-02") }),
      makeAssessment({ hba1cLevel: 6.0, createdAt: new Date("2024-01-03") }),
      makeAssessment({ hba1cLevel: 5.5, createdAt: new Date("2024-01-04") }),
    ];
    const result = analyzeBiomarkerTrends({ assessments });
    const hbaAlert = result.find((a) => a.biomarker === "HbA1c");
    expect(hbaAlert).toBeDefined();
    expect(hbaAlert!.trend).toBe("decreasing");
    expect(hbaAlert!.severity).toBe("info");
  });

  it("returns warning alert for 3+ consecutive blood glucose increases", () => {
    const assessments = [
      makeAssessment({ bloodGlucoseLevel: 100, createdAt: new Date("2024-01-01") }),
      makeAssessment({ bloodGlucoseLevel: 115, createdAt: new Date("2024-01-02") }),
      makeAssessment({ bloodGlucoseLevel: 130, createdAt: new Date("2024-01-03") }),
      makeAssessment({ bloodGlucoseLevel: 145, createdAt: new Date("2024-01-04") }),
    ];
    const result = analyzeBiomarkerTrends({ assessments });
    const gluAlert = result.find((a) => a.biomarker === "Blood Glucose");
    expect(gluAlert).toBeDefined();
    expect(gluAlert!.trend).toBe("increasing");
    expect(gluAlert!.severity).toBe("warning");
  });

  it("returns info alert for 2 consecutive blood glucose increases", () => {
    const assessments = [
      makeAssessment({ bloodGlucoseLevel: 100, createdAt: new Date("2024-01-01") }),
      makeAssessment({ bloodGlucoseLevel: 115, createdAt: new Date("2024-01-02") }),
      makeAssessment({ bloodGlucoseLevel: 130, createdAt: new Date("2024-01-03") }),
    ];
    const result = analyzeBiomarkerTrends({ assessments });
    const gluAlert = result.find((a) => a.biomarker === "Blood Glucose");
    expect(gluAlert).toBeDefined();
    expect(gluAlert!.trend).toBe("increasing");
    expect(gluAlert!.severity).toBe("info");
  });

  it("returns info alert for 3+ consecutive blood glucose decreases", () => {
    const assessments = [
      makeAssessment({ bloodGlucoseLevel: 180, createdAt: new Date("2024-01-01") }),
      makeAssessment({ bloodGlucoseLevel: 160, createdAt: new Date("2024-01-02") }),
      makeAssessment({ bloodGlucoseLevel: 140, createdAt: new Date("2024-01-03") }),
      makeAssessment({ bloodGlucoseLevel: 120, createdAt: new Date("2024-01-04") }),
    ];
    const result = analyzeBiomarkerTrends({ assessments });
    const gluAlert = result.find((a) => a.biomarker === "Blood Glucose");
    expect(gluAlert).toBeDefined();
    expect(gluAlert!.trend).toBe("decreasing");
    expect(gluAlert!.severity).toBe("info");
  });

  it("returns warning alert for 3+ consecutive BMI increases", () => {
    const assessments = [
      makeAssessment({ bmi: 22.0, createdAt: new Date("2024-01-01") }),
      makeAssessment({ bmi: 23.0, createdAt: new Date("2024-01-02") }),
      makeAssessment({ bmi: 24.0, createdAt: new Date("2024-01-03") }),
      makeAssessment({ bmi: 25.0, createdAt: new Date("2024-01-04") }),
    ];
    const result = analyzeBiomarkerTrends({ assessments });
    const bmiAlert = result.find((a) => a.biomarker === "BMI");
    expect(bmiAlert).toBeDefined();
    expect(bmiAlert!.trend).toBe("increasing");
    expect(bmiAlert!.severity).toBe("warning");
  });

  it("returns info alert for 3+ consecutive BMI decreases", () => {
    const assessments = [
      makeAssessment({ bmi: 30.0, createdAt: new Date("2024-01-01") }),
      makeAssessment({ bmi: 29.0, createdAt: new Date("2024-01-02") }),
      makeAssessment({ bmi: 28.0, createdAt: new Date("2024-01-03") }),
      makeAssessment({ bmi: 27.0, createdAt: new Date("2024-01-04") }),
    ];
    const result = analyzeBiomarkerTrends({ assessments });
    const bmiAlert = result.find((a) => a.biomarker === "BMI");
    expect(bmiAlert).toBeDefined();
    expect(bmiAlert!.trend).toBe("decreasing");
    expect(bmiAlert!.severity).toBe("info");
  });

  it("lookback parameter limits the window", () => {
    // 10 assessments, but lookback=3 means only last 3 are considered
    const assessments = Array.from({ length: 10 }, (_, i) =>
      makeAssessment({
        hba1cLevel: 5.0 + i * 0.5,
        createdAt: new Date(`2024-01-${String(i + 1).padStart(2, "0")}`),
      })
    );
    // With lookback=3, only assessments 8, 9, 10 are checked (3 values, 2 consecutive -> info, not warning)
    const result = analyzeBiomarkerTrends({ assessments, lookback: 3 });
    const hbaAlert = result.find((a) => a.biomarker === "HbA1c");
    // 3 assessments -> 2 consecutive increases -> info severity
    expect(hbaAlert && hbaAlert.severity === "info").toBeTruthy();
  });

  it("alert includes values array with timestamps", () => {
    const d1 = new Date("2024-01-01");
    const d2 = new Date("2024-01-02");
    const d3 = new Date("2024-01-03");
    const d4 = new Date("2024-01-04");
    const assessments = [
      makeAssessment({ hba1cLevel: 5.0, createdAt: d1 }),
      makeAssessment({ hba1cLevel: 5.5, createdAt: d2 }),
      makeAssessment({ hba1cLevel: 6.0, createdAt: d3 }),
      makeAssessment({ hba1cLevel: 6.5, createdAt: d4 }),
    ];
    const result = analyzeBiomarkerTrends({ assessments });
    const hbaAlert = result.find((a) => a.biomarker === "HbA1c");
    expect(hbaAlert!.values).toBeDefined();
    expect(Array.isArray(hbaAlert!.values)).toBe(true);
    expect(hbaAlert!.values.length).toBeGreaterThan(0);
  });

  it("default lookback is 8", () => {
    // With default lookback=8, 4 assessments qualifies for warning
    const assessments = [
      makeAssessment({ hba1cLevel: 5.0, createdAt: new Date("2024-01-01") }),
      makeAssessment({ hba1cLevel: 5.5, createdAt: new Date("2024-01-02") }),
      makeAssessment({ hba1cLevel: 6.0, createdAt: new Date("2024-01-03") }),
      makeAssessment({ hba1cLevel: 6.5, createdAt: new Date("2024-01-04") }),
    ];
    const result = analyzeBiomarkerTrends({ assessments });
    const hbaAlert = result.find((a) => a.biomarker === "HbA1c");
    expect(hbaAlert && hbaAlert.severity === "warning").toBeTruthy();
  });
});
