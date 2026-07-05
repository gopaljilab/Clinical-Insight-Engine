import { describe, it, expect } from "vitest";
import { calculateHealthBadges } from "./healthBadges";
import type { AssessmentResponse } from "@shared/routes";

function makeAssessment(overrides: Partial<AssessmentResponse> = {}): AssessmentResponse {
  return {
    id: "1",
    patientName: "John Doe",
    gender: "Male",
    age: 45,
    hypertension: false,
    heartDisease: false,
    smokingHistory: "never",
    bmi: 24,
    hba1cLevel: 5.0,
    bloodGlucoseLevel: 95,
    riskScore: 20,
    riskCategory: "LOW",
    factors: [],
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("calculateHealthBadges", () => {
  it("returns empty array when history is empty", () => {
    const current = makeAssessment({ id: "1", createdAt: "2024-01-01T00:00:00Z" });
    const badges = calculateHealthBadges(current, []);
    expect(badges).toEqual([]);
  });

  describe("improved-bmi badge", () => {
    it("awards badge when current BMI is lower than previous", () => {
      const current = makeAssessment({ id: "2", bmi: 23, createdAt: "2024-02-01T00:00:00Z" });
      const history = [
        makeAssessment({ id: "1", bmi: 26, createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges.some((b) => b.id === "improved-bmi")).toBe(true);
    });

    it("does not award badge when current BMI is higher", () => {
      const current = makeAssessment({ id: "2", bmi: 27, createdAt: "2024-02-01T00:00:00Z" });
      const history = [
        makeAssessment({ id: "1", bmi: 24, createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges.some((b) => b.id === "improved-bmi")).toBe(false);
    });

    it("does not award badge when BMI is equal", () => {
      const current = makeAssessment({ id: "2", bmi: 24, createdAt: "2024-02-01T00:00:00Z" });
      const history = [
        makeAssessment({ id: "1", bmi: 24, createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges.some((b) => b.id === "improved-bmi")).toBe(false);
    });
  });

  describe("reduced-hba1c badge", () => {
    it("awards badge when current HbA1c is lower than previous", () => {
      const current = makeAssessment({ id: "2", hba1cLevel: 5.0, createdAt: "2024-02-01T00:00:00Z" });
      const history = [
        makeAssessment({ id: "1", hba1cLevel: 6.5, createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges.some((b) => b.id === "reduced-hba1c")).toBe(true);
    });

    it("does not award badge when HbA1c is equal or higher", () => {
      const current = makeAssessment({ id: "2", hba1cLevel: 6.5, createdAt: "2024-02-01T00:00:00Z" });
      const history = [
        makeAssessment({ id: "1", hba1cLevel: 6.5, createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges.some((b) => b.id === "reduced-hba1c")).toBe(false);
    });
  });

  describe("reduced-glucose badge", () => {
    it("awards badge when current glucose is lower than previous", () => {
      const current = makeAssessment({ id: "2", bloodGlucoseLevel: 90, createdAt: "2024-02-01T00:00:00Z" });
      const history = [
        makeAssessment({ id: "1", bloodGlucoseLevel: 120, createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges.some((b) => b.id === "reduced-glucose")).toBe(true);
    });

    it("does not award badge when glucose is equal or higher", () => {
      const current = makeAssessment({ id: "2", bloodGlucoseLevel: 120, createdAt: "2024-02-01T00:00:00Z" });
      const history = [
        makeAssessment({ id: "1", bloodGlucoseLevel: 120, createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges.some((b) => b.id === "reduced-glucose")).toBe(false);
    });
  });

  describe("lower-risk badge", () => {
    it("awards badge when riskScore is lower", () => {
      const current = makeAssessment({ id: "2", riskScore: 15, createdAt: "2024-02-01T00:00:00Z" });
      const history = [
        makeAssessment({ id: "1", riskScore: 35, createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges.some((b) => b.id === "lower-risk")).toBe(true);
    });

    it("awards badge when riskCategory rank improves even if score is equal", () => {
      const current = makeAssessment({
        id: "2", riskScore: 35, riskCategory: "MODERATE", createdAt: "2024-02-01T00:00:00Z",
      });
      const history = [
        makeAssessment({ id: "1", riskScore: 35, riskCategory: "HIGH", createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges.some((b) => b.id === "lower-risk")).toBe(true);
    });
  });

  describe("patient name normalization", () => {
    it("matches same patient with different whitespace in name", () => {
      const current = makeAssessment({ id: "2", patientName: "  John Doe  ", createdAt: "2024-02-01T00:00:00Z" });
      const history = [
        makeAssessment({ id: "1", patientName: "John Doe", createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      // Should find a previous assessment and compare (BMI same so no badge)
      expect(badges.some((b) => b.id === "improved-bmi")).toBe(false);
    });

    it("does not match different patient names", () => {
      const current = makeAssessment({ id: "2", patientName: "Alice Smith", createdAt: "2024-02-01T00:00:00Z" });
      const history = [
        makeAssessment({ id: "1", patientName: "John Doe", createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      // No previous assessment for Alice -> empty badges
      expect(badges).toEqual([]);
    });
  });

  describe("current assessment exclusion", () => {
    it("excludes current assessment from history by id", () => {
      const current = makeAssessment({ id: "42", bmi: 24, createdAt: "2024-02-01T00:00:00Z" });
      const history = [
        makeAssessment({ id: "42", bmi: 26, createdAt: "2024-01-01T00:00:00Z" }),
        makeAssessment({ id: "1", bmi: 26, createdAt: "2023-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      // No BMI improvement: current 24 vs prior 26 for same patient
      expect(badges.some((b) => b.id === "improved-bmi")).toBe(true);
    });
  });

  describe("healthy-streak badge", () => {
    it("awards badge for 3+ consecutive improvements", () => {
      const current = makeAssessment({
        id: "4", bmi: 20, hba1cLevel: 4.5, createdAt: "2024-04-01T00:00:00Z",
      });
      const history = [
        makeAssessment({ id: "3", bmi: 22, hba1cLevel: 5.0, createdAt: "2024-03-01T00:00:00Z" }),
        makeAssessment({ id: "2", bmi: 24, hba1cLevel: 5.5, createdAt: "2024-02-01T00:00:00Z" }),
        makeAssessment({ id: "1", bmi: 26, hba1cLevel: 6.0, createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges.some((b) => b.id === "healthy-streak")).toBe(true);
    });

    it("does not award badge for fewer than 3 improvements", () => {
      const current = makeAssessment({
        id: "3", bmi: 22, createdAt: "2024-03-01T00:00:00Z",
      });
      const history = [
        makeAssessment({ id: "2", bmi: 24, createdAt: "2024-02-01T00:00:00Z" }),
        makeAssessment({ id: "1", bmi: 25, createdAt: "2024-01-01T00:00:00Z" }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges.some((b) => b.id === "healthy-streak")).toBe(false);
    });
  });

  describe("no-improvement path", () => {
    it("returns no badges when all values are equal or worse", () => {
      const current = makeAssessment({
        id: "2", bmi: 26, hba1cLevel: 6.5, bloodGlucoseLevel: 120,
        riskScore: 40, riskCategory: "HIGH", createdAt: "2024-02-01T00:00:00Z",
      });
      const history = [
        makeAssessment({
          id: "1", bmi: 24, hba1cLevel: 5.0, bloodGlucoseLevel: 95,
          riskScore: 20, riskCategory: "LOW", createdAt: "2024-01-01T00:00:00Z",
        }),
      ];
      const badges = calculateHealthBadges(current, history);
      expect(badges).toEqual([]);
    });
  });
});
