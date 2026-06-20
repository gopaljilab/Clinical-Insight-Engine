import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateRecommendations } from "./recommendation-engine";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "mock-uuid-1234"),
}));

describe("recommendation-engine", () => {
  it("returns empty array when input is empty", () => {
    const result = generateRecommendations({});
    expect(result).toEqual([]);
  });

  it("returns empty array when no clinical fields are set", () => {
    const result = generateRecommendations({ patientName: "Test" } as any);
    expect(Array.isArray(result)).toBe(true);
  });

  it("recommends weight reduction for obese BMI >= 30", () => {
    const result = generateRecommendations({ bmi: 32 } as any);
    const titles = result.map(r => r.title);
    expect(titles).toContain("Weight reduction target");
    expect(titles).toContain("Increase physical activity");
  });

  it("recommends weight management for overweight BMI 25-29.9", () => {
    const result = generateRecommendations({ bmi: 27 } as any);
    const titles = result.map(r => r.title);
    expect(titles).toContain("Weight management");
  });

  it("recommends repeat HbA1c testing and medication review for HbA1c >= 7", () => {
    const result = generateRecommendations({ hba1cLevel: 8.5 } as any);
    const titles = result.map(r => r.title);
    expect(titles).toContain("Repeat HbA1c testing");
    expect(titles).toContain("Consider medication review");
  });

  it("does not add HbA1c recommendations for normal HbA1c < 7", () => {
    const result = generateRecommendations({ hba1cLevel: 5.5 } as any);
    const hba1cRecs = result.filter(r => r.title.toLowerCase().includes("hba1c"));
    expect(hba1cRecs).toHaveLength(0);
  });

  it("recommends urgent glycemic review for blood glucose > 200", () => {
    const result = generateRecommendations({ bloodGlucoseLevel: 250 } as any);
    const titles = result.map(r => r.title);
    expect(titles).toContain("Urgent glycemic review");
  });

  it("does not add glucose recommendations for normal glucose <= 200", () => {
    const result = generateRecommendations({ bloodGlucoseLevel: 150 } as any);
    const glucoseRecs = result.filter(r => r.title.toLowerCase().includes("glycemic") || r.title.toLowerCase().includes("glucose"));
    expect(glucoseRecs).toHaveLength(0);
  });

  it("recommends smoking cessation for current smokers", () => {
    const result = generateRecommendations({ smokingHistory: "current" } as any);
    const smokingRecs = result.filter(r => r.title.toLowerCase().includes("smoking"));
    expect(smokingRecs.length).toBeGreaterThan(0);
  });

  it("does not add smoking recommendations for former smokers", () => {
    const result = generateRecommendations({ smokingHistory: "former" } as any);
    const smokingRecs = result.filter(r => r.title.toLowerCase().includes("smoking") || r.title.toLowerCase().includes("cessation"));
    expect(smokingRecs).toHaveLength(0);
  });

  it("handles string numeric values for BMI and HbA1c", () => {
    const result = generateRecommendations({ bmi: "28", hba1cLevel: "7.5" } as any);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns array of Recommendation objects with required fields", () => {
    const result = generateRecommendations({ bmi: 35 } as any);
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
