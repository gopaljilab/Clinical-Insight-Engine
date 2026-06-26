import { describe, it, expect } from "vitest";
import { generateRecommendations } from "./recommendation-engine";

describe("generateRecommendations", () => {
  it("returns empty array for minimal input", () => {
    const result = generateRecommendations({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns 'Medication and Lifestyle Check' for any input (default rule)", () => {
    const result = generateRecommendations({});
    expect(result.some((r) => r.title === "Medication and Lifestyle Check")).toBe(true);
  });

  it("returns weight reduction recommendations for obese BMI", () => {
    const result = generateRecommendations({ bmi: 32 });
    expect(result.some((r) => r.title === "Weight reduction target")).toBe(true);
    expect(result.some((r) => r.title === "Increase physical activity")).toBe(true);
  });

  it("returns weight management recommendation for overweight BMI", () => {
    const result = generateRecommendations({ bmi: 27 });
    expect(result.some((r) => r.title === "Weight management")).toBe(true);
  });

  it("does not return weight recommendations for normal BMI", () => {
    const result = generateRecommendations({ bmi: 22 });
    expect(result.some((r) => r.title === "Weight reduction target")).toBe(false);
    expect(result.some((r) => r.title === "Weight management")).toBe(false);
    expect(result.some((r) => r.title === "Increase physical activity")).toBe(false);
  });

  it("returns Repeat HbA1c testing for HbA1c >= 7", () => {
    const result = generateRecommendations({ hba1cLevel: 7.5 });
    expect(result.some((r) => r.title === "Repeat HbA1c testing")).toBe(true);
  });

  it("returns Consider medication review for HbA1c >= 7", () => {
    const result = generateRecommendations({ hba1cLevel: 8.0 });
    const rec = result.find((r) => r.title === "Consider medication review");
    expect(rec).toBeDefined();
    expect(rec?.urgency).toBe("high");
    expect(rec?.audience).toBe("clinician");
  });

  it("does not return medication review for HbA1c < 7", () => {
    const result = generateRecommendations({ hba1cLevel: 6.5 });
    expect(result.some((r) => r.title === "Consider medication review")).toBe(false);
    expect(result.some((r) => r.title === "Repeat HbA1c testing")).toBe(false);
  });

  it("returns Urgent glycemic review for blood glucose > 200", () => {
    const result = generateRecommendations({ bloodGlucoseLevel: 250 });
    expect(result.some((r) => r.title === "Urgent glycemic review")).toBe(true);
    const rec = result.find((r) => r.title === "Urgent glycemic review");
    expect(rec?.urgency).toBe("high");
    expect(rec?.audience).toBe("clinician");
  });

  it("does not return urgent glycemic review for blood glucose <= 200", () => {
    const result = generateRecommendations({ bloodGlucoseLevel: 200 });
    expect(result.some((r) => r.title === "Urgent glycemic review")).toBe(false);
  });

  it("returns Regular Blood Glucose Monitoring for blood glucose >= 140", () => {
    const result = generateRecommendations({ bloodGlucoseLevel: 150 });
    expect(result.some((r) => r.title === "Regular Blood Glucose Monitoring")).toBe(true);
    const rec = result.find((r) => r.title === "Regular Blood Glucose Monitoring");
    expect(rec?.urgency).toBe("medium");
  });

  it("returns Smoking cessation counseling for current smoker", () => {
    const result = generateRecommendations({ smokingHistory: "current" });
    expect(result.some((r) => r.title === "Smoking cessation counseling")).toBe(true);
    const rec = result.find((r) => r.title === "Smoking cessation counseling");
    expect(rec?.urgency).toBe("high");
    expect(rec?.audience).toBe("both");
  });

  it("does not return smoking cessation for former smoker", () => {
    const result = generateRecommendations({ smokingHistory: "former" });
    expect(result.some((r) => r.title === "Smoking cessation counseling")).toBe(false);
  });

  it("does not return smoking cessation for never smoker", () => {
    const result = generateRecommendations({ smokingHistory: "never" });
    expect(result.some((r) => r.title === "Smoking cessation counseling")).toBe(false);
  });

  it("returns Monitor blood pressure for hypertension = true", () => {
    const result = generateRecommendations({ hypertension: true });
    expect(result.some((r) => r.title === "Monitor blood pressure")).toBe(true);
    const rec = result.find((r) => r.title === "Monitor blood pressure");
    expect(rec?.urgency).toBe("medium");
  });

  it("does not return blood pressure monitor for hypertension = false", () => {
    const result = generateRecommendations({ hypertension: false });
    expect(result.some((r) => r.title === "Monitor blood pressure")).toBe(false);
  });

  it("returns Cardiology follow-up for heart disease = true", () => {
    const result = generateRecommendations({ heartDisease: true });
    expect(result.some((r) => r.title === "Cardiology follow-up")).toBe(true);
    const rec = result.find((r) => r.title === "Cardiology follow-up");
    expect(rec?.urgency).toBe("high");
    expect(rec?.audience).toBe("clinician");
  });

  it("does not return cardiology follow-up for heart disease = false", () => {
    const result = generateRecommendations({ heartDisease: false });
    expect(result.some((r) => r.title === "Cardiology follow-up")).toBe(false);
  });

  it("returns Age-appropriate preventive checks for age >= 65", () => {
    const result = generateRecommendations({ age: 70 });
    expect(result.some((r) => r.title === "Age-appropriate preventive checks")).toBe(true);
  });

  it("does not return age-appropriate checks for age < 65", () => {
    const result = generateRecommendations({ age: 60 });
    expect(result.some((r) => r.title === "Age-appropriate preventive checks")).toBe(false);
  });

  it("returns Intensive risk management for HIGH riskCategory", () => {
    const result = generateRecommendations({ riskCategory: "HIGH" });
    expect(result.some((r) => r.title === "Intensive risk management")).toBe(true);
    const rec = result.find((r) => r.title === "Intensive risk management");
    expect(rec?.urgency).toBe("high");
    expect(rec?.audience).toBe("clinician");
  });

  it("does not return intensive risk management for LOW riskCategory", () => {
    const result = generateRecommendations({ riskCategory: "LOW" });
    expect(result.some((r) => r.title === "Intensive risk management")).toBe(false);
  });

  it("returns Schedule Follow-up Appointment for HIGH riskCategory", () => {
    const result = generateRecommendations({ riskCategory: "HIGH" });
    expect(result.some((r) => r.title === "Schedule Follow-up Appointment")).toBe(true);
    const rec = result.find((r) => r.title === "Schedule Follow-up Appointment");
    expect(rec?.urgency).toBe("high");
  });

  it("returns Schedule Follow-up Appointment for MODERATE riskCategory", () => {
    const result = generateRecommendations({ riskCategory: "MODERATE" });
    expect(result.some((r) => r.title === "Schedule Follow-up Appointment")).toBe(true);
  });

  it("does not return Schedule Follow-up Appointment for LOW riskCategory", () => {
    const result = generateRecommendations({ riskCategory: "LOW" });
    expect(result.some((r) => r.title === "Schedule Follow-up Appointment")).toBe(false);
  });

  it("returns HbA1c Follow-up Test Reminder for HbA1c >= 5.7", () => {
    const result = generateRecommendations({ hba1cLevel: 6.0 });
    expect(result.some((r) => r.title === "HbA1c Follow-up Test Reminder")).toBe(true);
    const rec = result.find((r) => r.title === "HbA1c Follow-up Test Reminder");
    expect(rec?.urgency).toBe("medium");
  });

  it("combines multiple conditions correctly", () => {
    const result = generateRecommendations({
      bmi: 33,
      hba1cLevel: 8.0,
      bloodGlucoseLevel: 220,
      smokingHistory: "current",
      hypertension: true,
      heartDisease: true,
      age: 70,
      riskCategory: "HIGH",
    });

    expect(result.some((r) => r.title === "Weight reduction target")).toBe(true);
    expect(result.some((r) => r.title === "Increase physical activity")).toBe(true);
    expect(result.some((r) => r.title === "Repeat HbA1c testing")).toBe(true);
    expect(result.some((r) => r.title === "Consider medication review")).toBe(true);
    expect(result.some((r) => r.title === "Urgent glycemic review")).toBe(true);
    expect(result.some((r) => r.title === "Regular Blood Glucose Monitoring")).toBe(true);
    expect(result.some((r) => r.title === "Smoking cessation counseling")).toBe(true);
    expect(result.some((r) => r.title === "Monitor blood pressure")).toBe(true);
    expect(result.some((r) => r.title === "Cardiology follow-up")).toBe(true);
    expect(result.some((r) => r.title === "Age-appropriate preventive checks")).toBe(true);
    expect(result.some((r) => r.title === "Intensive risk management")).toBe(true);
    expect(result.some((r) => r.title === "Schedule Follow-up Appointment")).toBe(true);
    expect(result.some((r) => r.title === "HbA1c Follow-up Test Reminder")).toBe(true);
    expect(result.some((r) => r.title === "Medication and Lifestyle Check")).toBe(true);
  });

  it("each returned recommendation has required fields", () => {
    const result = generateRecommendations({ bmi: 32 });
    for (const rec of result) {
      expect(typeof rec.id).toBe("string");
      expect(rec.id.length).toBeGreaterThan(0);
      expect(typeof rec.title).toBe("string");
      expect(rec.title.length).toBeGreaterThan(0);
      expect(typeof rec.description).toBe("string");
      expect(rec.description.length).toBeGreaterThan(0);
      expect(["low", "medium", "high"]).toContain(rec.urgency);
      expect(["patient", "clinician", "both"]).toContain(rec.audience);
      expect(typeof rec.checklist).toBe("boolean");
    }
  });

  it("handles string BMI values", () => {
    const result = generateRecommendations({ bmi: "32" } as any);
    expect(result.some((r) => r.title === "Weight reduction target")).toBe(true);
  });

  it("handles undefined smokingHistory gracefully", () => {
    const result = generateRecommendations({});
    expect(result.some((r) => r.title === "Smoking cessation counseling")).toBe(false);
  });

  it("recommendations are deduplicated by title and description", () => {
    const result = generateRecommendations({ bmi: 32 });
    const titles = result.map((r) => r.title);
    const uniqueTitles = [...new Set(titles)];
    expect(titles.length).toBe(uniqueTitles.length);
  });
});
