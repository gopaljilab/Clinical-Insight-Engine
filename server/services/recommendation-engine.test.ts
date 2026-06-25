import { describe, expect, it, vi } from "vitest";
import { generateRecommendations } from "./recommendation-engine";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-123"),
}));

const base = {
  patientName: "Test Patient",
  gender: "Male" as const,
  age: 45,
  hypertension: false,
  heartDisease: false,
  smokingHistory: "never" as const,
  bmi: 22.0,
  hba1cLevel: 5.0,
  bloodGlucoseLevel: 100,
  insulin: 0,
  skinThickness: 0,
  riskScore: 10,
  riskCategory: "LOW" as const,
  factors: [],
  confidenceInterval: null,
  modelConfidence: 0.9,
};

describe("recommendation-engine", () => {
  describe("BMI rule", () => {
    it("returns weight-reduction and activity recs for BMI >= 30", () => {
      const result = generateRecommendations({ ...base, bmi: 32 });
      const titles = result.map(r => r.title);
      expect(titles).toContain("Weight reduction target");
      expect(titles).toContain("Increase physical activity");
    });

    it("returns weight-management rec for BMI 25-29", () => {
      const result = generateRecommendations({ ...base, bmi: 27 });
      const titles = result.map(r => r.title);
      expect(titles).toContain("Weight management");
    });

    it("returns no BMI recs for normal BMI < 25", () => {
      const result = generateRecommendations({ ...base, bmi: 22 });
      const bmiRecs = result.filter(r => r.title.toLowerCase().includes("weight"));
      expect(bmiRecs).toHaveLength(0);
    });
  });

  describe("HbA1c rule", () => {
    it("returns repeat-testing and medication-review for hba1c >= 7", () => {
      const result = generateRecommendations({ ...base, hba1cLevel: 8.5 });
      const titles = result.map(r => r.title);
      expect(titles).toContain("Repeat HbA1c testing");
      expect(titles).toContain("Consider medication review");
    });

    it("returns no HbA1c recs for normal hba1c < 7", () => {
      const result = generateRecommendations({ ...base, hba1cLevel: 5.5 });
      const hba1cRecs = result.filter(r => r.title.toLowerCase().includes("hba1c") ||
        r.title.toLowerCase().includes("medication"));
      expect(hba1cRecs).toHaveLength(0);
    });
  });

  describe("Blood glucose rule", () => {
    it("returns urgent-review for glucose > 200", () => {
      const result = generateRecommendations({ ...base, bloodGlucoseLevel: 250 });
      const titles = result.map(r => r.title);
      expect(titles).toContain("Urgent glycemic review");
    });

    it("returns no glucose rec for normal levels <= 200", () => {
      const result = generateRecommendations({ ...base, bloodGlucoseLevel: 150 });
      const glucoseRecs = result.filter(r => r.title.toLowerCase().includes("glycemic"));
      expect(glucoseRecs).toHaveLength(0);
    });
  });

  describe("Smoking rule", () => {
    it("returns cessation-counseling for current smoker", () => {
      const result = generateRecommendations({ ...base, smokingHistory: "current" });
      const titles = result.map(r => r.title);
      expect(titles).toContain("Smoking cessation counseling");
    });

    it("returns no rec for non-current smokers", () => {
      for (const hist of ["never", "former", "unknown"]) {
        const result = generateRecommendations({ ...base, smokingHistory: hist as any });
        const recs = result.filter(r => r.title.toLowerCase().includes("smoking"));
        expect(recs).toHaveLength(0);
      }
    });
  });

  describe("Hypertension rule", () => {
    it("returns BP-monitoring rec for hypertensive patient", () => {
      const result = generateRecommendations({ ...base, hypertension: true });
      const titles = result.map(r => r.title);
      expect(titles).toContain("Monitor blood pressure");
    });

    it("returns no BP rec for non-hypertensive patient", () => {
      const result = generateRecommendations({ ...base, hypertension: false });
      const recs = result.filter(r => r.title.toLowerCase().includes("blood pressure"));
      expect(recs).toHaveLength(0);
    });
  });

  describe("Heart disease rule", () => {
    it("returns cardiology rec for patient with heart disease", () => {
      const result = generateRecommendations({ ...base, heartDisease: true });
      const titles = result.map(r => r.title);
      expect(titles).toContain("Cardiology follow-up");
    });

    it("returns no cardiology rec for patient without heart disease", () => {
      const result = generateRecommendations({ ...base, heartDisease: false });
      const recs = result.filter(r => r.title.toLowerCase().includes("cardiology"));
      expect(recs).toHaveLength(0);
    });
  });

  describe("Age rule", () => {
    it("returns preventive-checks rec for age >= 65", () => {
      const result = generateRecommendations({ ...base, age: 70 });
      const titles = result.map(r => r.title);
      expect(titles).toContain("Age-appropriate preventive checks");
    });

    it("returns no preventive rec for age < 65", () => {
      const result = generateRecommendations({ ...base, age: 50 });
      const recs = result.filter(r => r.title.toLowerCase().includes("preventive"));
      expect(recs).toHaveLength(0);
    });
  });

  describe("Risk category rule", () => {
    it("returns intensive-risk-management for HIGH risk category", () => {
      const result = generateRecommendations({ ...base, riskCategory: "HIGH" as any });
      const titles = result.map(r => r.title);
      expect(titles).toContain("Intensive risk management");
    });

    it("returns no intensive rec for non-HIGH risk category", () => {
      for (const cat of ["LOW", "MODERATE"]) {
        const result = generateRecommendations({ ...base, riskCategory: cat as any });
        const recs = result.filter(r => r.title.toLowerCase().includes("intensive"));
        expect(recs).toHaveLength(0);
      }
    });
  });

  describe("Deduplication", () => {
    it("deduplicates recs with identical title and description", () => {
      const input = {
        ...base,
        bmi: 35,  // triggers weight-reduction rec
        hypertension: true,
      };
      // Both rules could theoretically produce the same rec if titles match
      const result = generateRecommendations(input);
      const titleDescPairs = result.map(r => `${r.title}:${r.description}`);
      const uniquePairs = new Set(titleDescPairs);
      expect(uniquePairs.size).toBe(titleDescPairs.length);
    });

    it("returns array (not null/undefined)", () => {
      const result = generateRecommendations(base);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("Rec properties", () => {
    it("each rec has required fields", () => {
      const result = generateRecommendations({ ...base, bmi: 35 });
      for (const rec of result) {
        expect(rec).toHaveProperty("id");
        expect(rec).toHaveProperty("title");
        expect(rec).toHaveProperty("description");
        expect(rec).toHaveProperty("urgency");
        expect(rec).toHaveProperty("audience");
        expect(rec).toHaveProperty("checklist");
      }
    });
  });
});
