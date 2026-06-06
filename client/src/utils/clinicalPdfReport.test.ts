import { describe, expect, it } from "vitest";
import { preparePatientSummaryReport, type PatientSummaryAssessment } from "./clinicalPdfReport";

const baseAssessment: PatientSummaryAssessment = {
  id: 1,
  patientName: "Jane Doe",
  gender: "Female",
  age: 52,
  createdAt: "2026-01-01T10:00:00.000Z",
  riskScore: 22,
  riskCategory: "LOW",
  bmi: 25.2,
  hba1cLevel: 6.1,
  bloodGlucoseLevel: 105,
  hypertension: false,
  heartDisease: false,
  smokingHistory: "never",
  factors: [
    {
      name: "BMI",
      impact: "positive",
      description: "BMI increased risk.",
    },
  ],
};

describe("preparePatientSummaryReport", () => {
  it("sorts patient history and summarizes latest assessment details", () => {
    const summary = preparePatientSummaryReport([
      baseAssessment,
      {
        ...baseAssessment,
        id: 2,
        createdAt: "2026-03-01T10:00:00.000Z",
        riskScore: 18,
        riskCategory: "LOW",
        bmi: 24.1,
        hba1cLevel: 5.8,
        bloodGlucoseLevel: 98,
      },
    ]);

    expect(summary.patientName).toBe("Jane Doe");
    expect(summary.latest?.id).toBe(2);
    expect(summary.assessmentCount).toBe(2);
    expect(summary.historyRows[0][1]).toBe("18.0%");
    expect(summary.trendSummary).toContain("Risk score: decreased by 4.0% from first to latest assessment.");
    expect(summary.trendSummary).toContain("BMI: decreased by 1.1 from first to latest assessment.");
  });

  it("handles a single assessment without failing trend preparation", () => {
    const summary = preparePatientSummaryReport([baseAssessment]);

    expect(summary.assessmentCount).toBe(1);
    expect(summary.latestRows).toContainEqual(["Assessments Reviewed", "1"]);
    expect(summary.trendSummary).toContain("Risk score: remained stable by 0.0% from first to latest assessment.");
  });

  it("handles empty or missing patient fields gracefully", () => {
    const summary = preparePatientSummaryReport([
      {
        ...baseAssessment,
        patientName: "",
        gender: "",
        age: undefined as unknown as number,
        riskScore: undefined as unknown as number,
      },
    ]);

    expect(summary.patientName).toBe("Unknown Patient");
    expect(summary.demographics).toContainEqual(["Gender", "N/A"]);
    expect(summary.demographics).toContainEqual(["Age", "N/A"]);
    expect(summary.latestRows).toContainEqual(["Latest Risk Score", "N/A"]);
  });

  it("deduplicates recent risk factors by name", () => {
    const factors = JSON.stringify([
      { name: "BMI", impact: "positive", description: "BMI risk." },
      { name: "HbA1c Level", impact: "positive", description: "Glucose control risk." },
    ]);

    const summary = preparePatientSummaryReport([
      { ...baseAssessment, id: 2, createdAt: "2026-02-01T10:00:00.000Z", factors },
      { ...baseAssessment, id: 1, factors },
    ]);

    expect(summary.recentFactors.map((factor) => factor.name)).toEqual(["BMI", "HbA1c Level"]);
  });
});
