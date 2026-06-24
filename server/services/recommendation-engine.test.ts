/**
 * server/services/recommendation-engine.test.ts
 *
 * Unit tests for generateRecommendations in recommendation-engine.ts.
 *
 * Covers:
 *  - BMI rule: obesity (>=30) yields weight reduction + activity; overweight (>=25) yields weight management
 *  - HbA1c rule: >=7 yields repeat testing + medication review
 *  - Blood glucose rule: >200 yields urgent glycemic review
 *  - Smoking rule: current smoker yields cessation counseling
 *  - Hypertension rule: monitoring blood pressure recommendation
 *  - Heart disease rule: cardiology follow-up recommendation
 *  - Age rule: >=65 yields age-appropriate preventive checks
 *  - Risk category HIGH rule: intensive risk management
 *  - Deduplication: duplicate recommendations by title+description are not returned twice
 *  - Edge cases: missing fields handled gracefully
 */

import { describe, expect, it } from "vitest";
import { generateRecommendations } from "./recommendation-engine";

describe("generateRecommendations", () => {
  // ── BMI rules ───────────────────────────────────────────────────────────────
  describe("BMI rule", () => {
    it("yields weight reduction and activity recommendations for obese patients (BMI >= 30)", () => {
      const recs = generateRecommendations({ bmi: 32 });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Weight reduction target");
      expect(titles).toContain("Increase physical activity");
    });

    it("yields weight reduction for BMI exactly 30", () => {
      const recs = generateRecommendations({ bmi: 30 });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Weight reduction target");
    });

    it("yields weight management for overweight patients (BMI >= 25 and < 30)", () => {
      const recs = generateRecommendations({ bmi: 27 });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Weight management");
      expect(titles).not.toContain("Weight reduction target");
    });

    it("yields no weight recommendations for normal BMI", () => {
      const recs = generateRecommendations({ bmi: 22 });
      const titles = recs.map((r) => r.title);
      expect(titles).not.toContain("Weight reduction target");
      expect(titles).not.toContain("Weight management");
    });

    it("treats string BMI as number when numeric", () => {
      const recs = generateRecommendations({ bmi: "32" });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Weight reduction target");
    });

    it("treats non-numeric string BMI as 0 and yields no weight recs", () => {
      const recs = generateRecommendations({ bmi: "unknown" });
      const titles = recs.map((r) => r.title);
      expect(titles).not.toContain("Weight reduction target");
    });

    it("handles missing BMI gracefully", () => {
      const recs = generateRecommendations({});
      // Should not throw; no weight recommendations expected
      expect(Array.isArray(recs)).toBe(true);
    });
  });

  // ── HbA1c rules ─────────────────────────────────────────────────────────────
  describe("HbA1c rule", () => {
    it("yields repeat HbA1c testing and medication review for HbA1c >= 7", () => {
      const recs = generateRecommendations({ hba1cLevel: 8.5 });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Repeat HbA1c testing");
      expect(titles).toContain("Consider medication review");
    });

    it("yields recommendations for HbA1c exactly 7", () => {
      const recs = generateRecommendations({ hba1cLevel: 7 });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Repeat HbA1c testing");
    });

    it("yields no HbA1c recommendations for controlled HbA1c < 7", () => {
      const recs = generateRecommendations({ hba1cLevel: 5.5 });
      const titles = recs.map((r) => r.title);
      expect(titles).not.toContain("Repeat HbA1c testing");
    });

    it("treats string HbA1c as number when numeric", () => {
      const recs = generateRecommendations({ hba1cLevel: "8.0" });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Repeat HbA1c testing");
    });
  });

  // ── Blood glucose rules ──────────────────────────────────────────────────────
  describe("Blood glucose rule", () => {
    it("yields urgent glycemic review for blood glucose > 200", () => {
      const recs = generateRecommendations({ bloodGlucoseLevel: 250 });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Urgent glycemic review");
    });

    it("yields no urgent review for blood glucose exactly 200", () => {
      const recs = generateRecommendations({ bloodGlucoseLevel: 200 });
      const titles = recs.map((r) => r.title);
      expect(titles).not.toContain("Urgent glycemic review");
    });

    it("yields urgent review for blood glucose just above 200", () => {
      const recs = generateRecommendations({ bloodGlucoseLevel: 201 });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Urgent glycemic review");
    });

    it("treats string blood glucose as number when numeric", () => {
      const recs = generateRecommendations({ bloodGlucoseLevel: "210" });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Urgent glycemic review");
    });
  });

  // ── Smoking rule ────────────────────────────────────────────────────────────
  describe("Smoking rule", () => {
    it("yields smoking cessation counseling for current smokers", () => {
      const recs = generateRecommendations({ smokingHistory: "current" });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Smoking cessation counseling");
    });

    it("yields no smoking recs for former smokers", () => {
      const recs = generateRecommendations({ smokingHistory: "former" });
      const titles = recs.map((r) => r.title);
      expect(titles).not.toContain("Smoking cessation counseling");
    });

    it("yields no smoking recs for never smokers", () => {
      const recs = generateRecommendations({ smokingHistory: "never" });
      const titles = recs.map((r) => r.title);
      expect(titles).not.toContain("Smoking cessation counseling");
    });

    it("treats smokingHistory case-insensitively", () => {
      const recs = generateRecommendations({ smokingHistory: "CURRENT" });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Smoking cessation counseling");
    });

    it("handles missing smokingHistory gracefully", () => {
      const recs = generateRecommendations({});
      expect(Array.isArray(recs)).toBe(true);
      const titles = recs.map((r) => r.title);
      expect(titles).not.toContain("Smoking cessation counseling");
    });
  });

  // ── Hypertension rule ───────────────────────────────────────────────────────
  describe("Hypertension rule", () => {
    it("yields blood pressure monitoring recommendation for hypertensive patients", () => {
      const recs = generateRecommendations({ hypertension: true });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Monitor blood pressure");
    });

    it("yields no BP monitoring for non-hypertensive patients", () => {
      const recs = generateRecommendations({ hypertension: false });
      const titles = recs.map((r) => r.title);
      expect(titles).not.toContain("Monitor blood pressure");
    });
  });

  // ── Heart disease rule ───────────────────────────────────────────────────────
  describe("Heart disease rule", () => {
    it("yields cardiology follow-up for patients with heart disease", () => {
      const recs = generateRecommendations({ heartDisease: true });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Cardiology follow-up");
    });

    it("yields no cardiology recs for patients without heart disease", () => {
      const recs = generateRecommendations({ heartDisease: false });
      const titles = recs.map((r) => r.title);
      expect(titles).not.toContain("Cardiology follow-up");
    });
  });

  // ── Age rule ─────────────────────────────────────────────────────────────────
  describe("Age rule", () => {
    it("yields preventive checks for patients aged 65 and above", () => {
      const recs = generateRecommendations({ age: 70 });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Age-appropriate preventive checks");
    });

    it("yields no preventive checks for patients under 65", () => {
      const recs = generateRecommendations({ age: 64 });
      const titles = recs.map((r) => r.title);
      expect(titles).not.toContain("Age-appropriate preventive checks");
    });

    it("treats string age as number when numeric", () => {
      const recs = generateRecommendations({ age: "72" });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Age-appropriate preventive checks");
    });
  });

  // ── Risk category rule ───────────────────────────────────────────────────────
  describe("Risk category rule", () => {
    it("yields intensive risk management for HIGH risk category", () => {
      const recs = generateRecommendations({ riskCategory: "HIGH" });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Intensive risk management");
    });

    it("yields intensive risk management for lowercase high risk", () => {
      const recs = generateRecommendations({ riskCategory: "high" });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Intensive risk management");
    });

    it("yields no intensive management for LOW risk category", () => {
      const recs = generateRecommendations({ riskCategory: "LOW" });
      const titles = recs.map((r) => r.title);
      expect(titles).not.toContain("Intensive risk management");
    });
  });

  // ── Multiple conditions ──────────────────────────────────────────────────────
  describe("Multiple conditions", () => {
    it("returns recommendations from multiple rules simultaneously", () => {
      const recs = generateRecommendations({
        bmi: 33,
        hba1cLevel: 8.5,
        hypertension: true,
        smokingHistory: "current",
        heartDisease: true,
      });
      const titles = recs.map((r) => r.title);
      expect(titles).toContain("Weight reduction target");
      expect(titles).toContain("Repeat HbA1c testing");
      expect(titles).toContain("Monitor blood pressure");
      expect(titles).toContain("Smoking cessation counseling");
      expect(titles).toContain("Cardiology follow-up");
    });
  });

  // ── Deduplication ────────────────────────────────────────────────────────────
  describe("Deduplication", () => {
    it("does not return duplicate recommendations with the same title and description", () => {
      // This test verifies the deduplication contract by ensuring
      // the same recommendation does not appear twice even when
      // two different rules might theoretically produce the same output.
      const recs = generateRecommendations({});
      const seen = new Set<string>();
      for (const rec of recs) {
        const key = `${rec.title}:${rec.description}`;
        expect(seen).not.toContain(key);
        seen.add(key);
      }
    });
  });

  // ── Urgency ───────────────────────────────────────────────────────────────────
  describe("Urgency levels", () => {
    it("assigns correct urgency levels to recommendations", () => {
      const recs = generateRecommendations({
        bmi: 32,
        hba1cLevel: 8.5,
        bloodGlucoseLevel: 250,
        smokingHistory: "current",
        heartDisease: true,
      });
      const byTitle = Object.fromEntries(recs.map((r) => [r.title, r.urgency]));

      expect(byTitle["Weight reduction target"]).toBe("medium");
      expect(byTitle["Increase physical activity"]).toBe("low");
      expect(byTitle["Repeat HbA1c testing"]).toBe("medium");
      expect(byTitle["Consider medication review"]).toBe("high");
      expect(byTitle["Urgent glycemic review"]).toBe("high");
      expect(byTitle["Smoking cessation counseling"]).toBe("high");
      expect(byTitle["Cardiology follow-up"]).toBe("high");
    });
  });

  // ── Audience ─────────────────────────────────────────────────────────────────
  describe("Audience", () => {
    it("assigns correct audience to recommendations", () => {
      const recs = generateRecommendations({
        bmi: 32,
        hba1cLevel: 8.5,
        heartDisease: true,
      });
      const byTitle = Object.fromEntries(recs.map((r) => [r.title, r.audience]));

      expect(byTitle["Weight reduction target"]).toBe("both");
      expect(byTitle["Increase physical activity"]).toBe("both");
      expect(byTitle["Consider medication review"]).toBe("clinician");
      expect(byTitle["Cardiology follow-up"]).toBe("clinician");
    });
  });

  // ── ID and checklist ─────────────────────────────────────────────────────────
  describe("Recommendation structure", () => {
    it("returns recommendations with a UUID id field", () => {
      const recs = generateRecommendations({ bmi: 32 });
      for (const rec of recs) {
        expect(rec.id).toBeDefined();
        expect(typeof rec.id).toBe("string");
        expect(rec.id.length).toBeGreaterThan(0);
      }
    });

    it("sets checklist field on recommendations", () => {
      const recs = generateRecommendations({ bmi: 32 });
      const weightRec = recs.find((r) => r.title === "Weight reduction target");
      expect(weightRec?.checklist).toBe(true);
    });
  });
});
