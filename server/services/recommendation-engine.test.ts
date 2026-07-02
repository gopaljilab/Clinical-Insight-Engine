import { describe, it, expect } from "vitest";
import { generateRecommendations } from "./recommendation-engine";

function emptyInput() {
  return {
    bmi: 22,
    hba1cLevel: 5.0,
    bloodGlucoseLevel: 90,
    smokingHistory: "never",
    hypertension: false,
    heartDisease: false,
    age: 30,
    riskCategory: "LOW",
  };
}

describe("generateRecommendations", () => {
  describe("BMI rule", () => {
    it("yields 2 recs when BMI >= 30 (obese)", () => {
      const recs = generateRecommendations({ ...emptyInput(), bmi: 32 });
      const bmiRecs = recs.filter((r) => r.title.toLowerCase().includes("weight"));
      expect(bmiRecs.length).toBeGreaterThanOrEqual(1);
      const activityRec = recs.find((r) => r.title.toLowerCase().includes("physical"));
      expect(activityRec).toBeDefined();
    });

    it("yields 1 rec when BMI 25-29 (overweight)", () => {
      const recs = generateRecommendations({ ...emptyInput(), bmi: 27 });
      const bmiRecs = recs.filter((r) => r.title.toLowerCase().includes("weight"));
      expect(bmiRecs.length).toBe(1);
    });

    it("yields no rec when BMI < 25", () => {
      const recs = generateRecommendations({ ...emptyInput(), bmi: 24 });
      const bmiRecs = recs.filter((r) =>
        r.title.toLowerCase().includes("weight") ||
        r.title.toLowerCase().includes("physical")
      );
      expect(bmiRecs).toEqual([]);
    });
  });

  describe("HbA1c rule", () => {
    it("yields 2 recs when HbA1c >= 7", () => {
      const recs = generateRecommendations({ ...emptyInput(), hba1cLevel: 8.5 });
      const hba1cRecs = recs.filter((r) => r.title.toLowerCase().includes("hba1c") || r.title.toLowerCase().includes("medication"));
      expect(hba1cRecs.length).toBeGreaterThanOrEqual(1);
    });

    it("yields no rec when HbA1c < 5.7", () => {
      const recs = generateRecommendations({ ...emptyInput(), hba1cLevel: 5.5 });
      const hba1cRecs = recs.filter((r) => r.title.toLowerCase().includes("hba1c testing") || r.title.toLowerCase().includes("medication review"));
      expect(hba1cRecs).toEqual([]);
    });
  });

  describe("blood glucose rule", () => {
    it("yields urgent rec when glucose > 200", () => {
      const recs = generateRecommendations({ ...emptyInput(), bloodGlucoseLevel: 250 });
      const glucRecs = recs.filter((r) => r.title.toLowerCase().includes("glycemic") || r.title.toLowerCase().includes("glucose"));
      expect(glucRecs.length).toBeGreaterThanOrEqual(1);
      const urgent = glucRecs.find((r) => r.urgency === "high");
      expect(urgent).toBeDefined();
    });

    it("yields no rec when glucose <= 200", () => {
      const recs = generateRecommendations({ ...emptyInput(), bloodGlucoseLevel: 200 });
      const glucRecs = recs.filter((r) => r.title.toLowerCase().includes("glycemic"));
      expect(glucRecs).toEqual([]);
    });
  });

  describe("smoking rule", () => {
    it("yields cessation rec when smokingHistory is current", () => {
      const recs = generateRecommendations({ ...emptyInput(), smokingHistory: "current" });
      const smokeRecs = recs.filter((r) => r.title.toLowerCase().includes("smoking") || r.title.toLowerCase().includes("cessation"));
      expect(smokeRecs.length).toBeGreaterThanOrEqual(1);
    });

    it("yields no rec for never smokers", () => {
      const recs = generateRecommendations({ ...emptyInput(), smokingHistory: "never" });
      const smokeRecs = recs.filter((r) => r.title.toLowerCase().includes("smoking"));
      expect(smokeRecs).toEqual([]);
    });

    it("yields no rec for former smokers", () => {
      const recs = generateRecommendations({ ...emptyInput(), smokingHistory: "former" });
      const smokeRecs = recs.filter((r) => r.title.toLowerCase().includes("smoking"));
      expect(smokeRecs).toEqual([]);
    });
  });

  describe("hypertension rule", () => {
    it("yields BP monitoring rec when hypertension is true", () => {
      const recs = generateRecommendations({ ...emptyInput(), hypertension: true });
      const bpRecs = recs.filter((r) => r.title.toLowerCase().includes("blood pressure") || r.title.toLowerCase().includes("bp"));
      expect(bpRecs.length).toBeGreaterThanOrEqual(1);
    });

    it("yields no rec when hypertension is false", () => {
      const recs = generateRecommendations({ ...emptyInput(), hypertension: false });
      const bpRecs = recs.filter((r) => r.title.toLowerCase().includes("blood pressure"));
      expect(bpRecs).toEqual([]);
    });
  });

  describe("heart disease rule", () => {
    it("yields cardiology rec when heartDisease is true", () => {
      const recs = generateRecommendations({ ...emptyInput(), heartDisease: true });
      const cardioRecs = recs.filter((r) => r.title.toLowerCase().includes("cardiology") || r.title.toLowerCase().includes("heart"));
      expect(cardioRecs.length).toBeGreaterThanOrEqual(1);
    });

    it("yields no rec when heartDisease is false", () => {
      const recs = generateRecommendations({ ...emptyInput(), heartDisease: false });
      const cardioRecs = recs.filter((r) => r.title.toLowerCase().includes("cardiology"));
      expect(cardioRecs).toEqual([]);
    });
  });

  describe("age rule", () => {
    it("yields preventive rec when age >= 65", () => {
      const recs = generateRecommendations({ ...emptyInput(), age: 70 });
      const ageRecs = recs.filter((r) => r.title.toLowerCase().includes("preventive") || r.title.toLowerCase().includes("age"));
      expect(ageRecs.length).toBeGreaterThanOrEqual(1);
    });

    it("yields no rec when age < 65", () => {
      const recs = generateRecommendations({ ...emptyInput(), age: 64 });
      const ageRecs = recs.filter((r) => r.title.toLowerCase().includes("preventive"));
      expect(ageRecs).toEqual([]);
    });
  });

  describe("risk category rule", () => {
    it("yields intensive rec when riskCategory is HIGH", () => {
      const recs = generateRecommendations({ ...emptyInput(), riskCategory: "HIGH" });
      const riskRecs = recs.filter((r) => r.title.toLowerCase().includes("risk") || r.title.toLowerCase().includes("intensive"));
      expect(riskRecs.length).toBeGreaterThanOrEqual(1);
    });

    it("yields no rec for LOW risk category", () => {
      const recs = generateRecommendations({ ...emptyInput(), riskCategory: "LOW" });
      const riskRecs = recs.filter((r) => r.title.toLowerCase().includes("intensive"));
      expect(riskRecs).toEqual([]);
    });

    it("yields no rec for MODERATE risk category", () => {
      const recs = generateRecommendations({ ...emptyInput(), riskCategory: "MODERATE" });
      const riskRecs = recs.filter((r) => r.title.toLowerCase().includes("intensive"));
      expect(riskRecs).toEqual([]);
    });
  });

  describe("deduplication", () => {
    it("does not return duplicate recommendations for the same input", () => {
      const recs = generateRecommendations({
        ...emptyInput(),
        bmi: 35,
        hba1cLevel: 8.0,
        bloodGlucoseLevel: 220,
        smokingHistory: "current",
        hypertension: true,
        heartDisease: true,
        age: 70,
        riskCategory: "HIGH",
      });
      const titles = recs.map((r) => `${r.title}:${r.description}`);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(titles.length);
    });
  });

  describe("urgency and audience metadata", () => {
    it("assigns urgency and audience to each recommendation", () => {
      const recs = generateRecommendations({ ...emptyInput(), bmi: 35 });
      expect(recs.length).toBeGreaterThan(0);
      for (const rec of recs) {
        expect(["low", "medium", "high"]).toContain(rec.urgency);
        expect(["patient", "clinician", "both"]).toContain(rec.audience);
      }
    });
  });
});
