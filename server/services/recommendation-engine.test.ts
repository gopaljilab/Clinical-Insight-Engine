import { describe, it, expect } from "vitest";
import { generateRecommendations } from "./recommendation-engine";

describe("generateRecommendations", () => {
  it("returns an array", () => {
    const result = generateRecommendations({});
    expect(Array.isArray(result)).toBe(true);
  });

  describe("BMI rules", () => {
    it("returns weight recommendations when BMI >= 30 (obese)", () => {
      const result = generateRecommendations({ bmi: 32 });
      const titles = result.map((r) => r.title);
      expect(titles).toContain("Weight reduction target");
      expect(titles).toContain("Increase physical activity");
    });

    it("returns weight management when BMI >= 25 (overweight)", () => {
      const result = generateRecommendations({ bmi: 27 });
      const titles = result.map((r) => r.title);
      expect(titles).toContain("Weight management");
    });

    it("does not return weight recommendations when BMI < 25", () => {
      const result = generateRecommendations({ bmi: 22 });
      const titles = result.map((r) => r.title);
      expect(titles).not.toContain("Weight reduction target");
      expect(titles).not.toContain("Weight management");
    });

    it("handles BMI as string", () => {
      const result = generateRecommendations({ bmi: "32" as any });
      const titles = result.map((r) => r.title);
      expect(titles).toContain("Weight reduction target");
    });

    it("treats missing BMI as 0", () => {
      const result = generateRecommendations({});
      const titles = result.map((r) => r.title);
      expect(titles).not.toContain("Weight reduction target");
    });
  });

  describe("HbA1c rules", () => {
    it("returns HbA1c recommendations when hba1cLevel >= 7", () => {
      const result = generateRecommendations({ hba1cLevel: 8.5 });
      const titles = result.map((r) => r.title);
      expect(titles).toContain("Repeat HbA1c testing");
      expect(titles).toContain("Consider medication review");
    });

    it("returns medium urgency Repeat HbA1c testing", () => {
      const rec = generateRecommendations({ hba1cLevel: 7.5 }).find(
        (r) => r.title === "Repeat HbA1c testing"
      );
      expect(rec?.urgency).toBe("medium");
    });

    it("returns high urgency medication review for clinician audience", () => {
      const rec = generateRecommendations({ hba1cLevel: 8 }).find(
        (r) => r.title === "Consider medication review"
      );
      expect(rec?.urgency).toBe("high");
      expect(rec?.audience).toBe("clinician");
    });

    it("does not return HbA1c recommendations when hba1cLevel < 7", () => {
      const result = generateRecommendations({ hba1cLevel: 6.0 });
      const titles = result.map((r) => r.title);
      expect(titles).not.toContain("Repeat HbA1c testing");
    });
  });

  describe("blood glucose rules", () => {
    it("returns urgent review when bloodGlucoseLevel > 200", () => {
      const result = generateRecommendations({ bloodGlucoseLevel: 250 });
      const titles = result.map((r) => r.title);
      expect(titles).toContain("Urgent glycemic review");
    });

    it("does not return urgent review when bloodGlucoseLevel <= 200", () => {
      const result = generateRecommendations({ bloodGlucoseLevel: 180 });
      const titles = result.map((r) => r.title);
      expect(titles).not.toContain("Urgent glycemic review");
    });
  });

  describe("smoking history rules", () => {
    it("returns smoking cessation when smokingHistory is current", () => {
      const result = generateRecommendations({ smokingHistory: "current" });
      const titles = result.map((r) => r.title);
      expect(titles).toContain("Smoking cessation counseling");
    });

    it("does not return smoking cessation for former smokers", () => {
      const result = generateRecommendations({ smokingHistory: "former" });
      const titles = result.map((r) => r.title);
      expect(titles).not.toContain("Smoking cessation counseling");
    });

    it("handles missing smokingHistory", () => {
      const result = generateRecommendations({});
      const titles = result.map((r) => r.title);
      expect(titles).not.toContain("Smoking cessation counseling");
    });
  });

  describe("hypertension rules", () => {
    it("returns blood pressure monitoring when hypertension is true", () => {
      const result = generateRecommendations({ hypertension: true });
      const titles = result.map((r) => r.title);
      expect(titles).toContain("Monitor blood pressure");
    });

    it("does not return BP recommendation when hypertension is false", () => {
      const result = generateRecommendations({ hypertension: false });
      const titles = result.map((r) => r.title);
      expect(titles).not.toContain("Monitor blood pressure");
    });
  });

  describe("heart disease rules", () => {
    it("returns cardiology follow-up when heartDisease is true", () => {
      const result = generateRecommendations({ heartDisease: true });
      const titles = result.map((r) => r.title);
      expect(titles).toContain("Cardiology follow-up");
    });

    it("does not return cardiology recommendation when heartDisease is false", () => {
      const result = generateRecommendations({ heartDisease: false });
      const titles = result.map((r) => r.title);
      expect(titles).not.toContain("Cardiology follow-up");
    });
  });

  describe("age rules", () => {
    it("returns age-appropriate preventive checks when age >= 65", () => {
      const result = generateRecommendations({ age: 70 });
      const titles = result.map((r) => r.title);
      expect(titles).toContain("Age-appropriate preventive checks");
    });

    it("does not return age recommendation when age < 65", () => {
      const result = generateRecommendations({ age: 45 });
      const titles = result.map((r) => r.title);
      expect(titles).not.toContain("Age-appropriate preventive checks");
    });
  });

  describe("risk category rules", () => {
    it("returns intensive risk management for HIGH risk category", () => {
      const result = generateRecommendations({ riskCategory: "HIGH" });
      const titles = result.map((r) => r.title);
      expect(titles).toContain("Intensive risk management");
    });

    it("does not return intensive management for low risk", () => {
      const result = generateRecommendations({ riskCategory: "low" });
      const titles = result.map((r) => r.title);
      expect(titles).not.toContain("Intensive risk management");
    });
  });

  describe("deduplication", () => {
    it("returns each recommendation only once", () => {
      const result = generateRecommendations({ bmi: 32 });
      const titles = result.map((r) => r.title);
      const counts = titles.reduce(
        (acc, t) => ({ ...acc, [t]: (acc[t] || 0) + 1 }),
        {} as Record<string, number>
      );
      Object.values(counts).forEach((count) => {
        expect(count).toBe(1);
      });
    });
  });

  describe("composite cases", () => {
    it("returns multiple recommendations for high-risk patient", () => {
      const result = generateRecommendations({
        bmi: 34,
        hba1cLevel: 9.0,
        bloodGlucoseLevel: 250,
        smokingHistory: "current",
        hypertension: true,
        heartDisease: true,
        age: 68,
        riskCategory: "HIGH",
      });
      expect(result.length).toBeGreaterThan(5);
      const titles = result.map((r) => r.title);
      expect(titles).toContain("Weight reduction target");
      expect(titles).toContain("Repeat HbA1c testing");
      expect(titles).toContain("Urgent glycemic review");
      expect(titles).toContain("Smoking cessation counseling");
      expect(titles).toContain("Monitor blood pressure");
      expect(titles).toContain("Cardiology follow-up");
      expect(titles).toContain("Age-appropriate preventive checks");
      expect(titles).toContain("Intensive risk management");
    });
  });
});
