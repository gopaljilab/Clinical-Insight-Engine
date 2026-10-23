import { afterEach, describe, expect, it, vi } from "vitest";
import { pythonDaemon, runAssessmentInference } from "./mlService";

const patient = {
  age: 52,
  gender: "Female",
  hypertension: true,
  heartDisease: false,
  smokingHistory: "former",
  bmi: 30.1,
  hba1cLevel: 6.4,
  bloodGlucoseLevel: 148,
};

afterEach(() => {
  delete process.env.PREDICTION_MODE;
  delete process.env.MAX_RETRIES;
  vi.restoreAllMocks();
});

describe("production ML inference behavior", () => {
  it("returns a service error instead of a rule-based score when ML is unavailable", async () => {
    process.env.MAX_RETRIES = "0";
    vi.spyOn(pythonDaemon, "predict").mockRejectedValue(new Error("Python daemon is not running."));
    await expect(runAssessmentInference(patient)).rejects.toMatchObject({ statusCode: 503 });
  });

  it("labels the explicitly selected rule-based mode and omits fabricated confidence", async () => {
    process.env.PREDICTION_MODE = "rule-based";
    const result = await runAssessmentInference(patient);
    expect(result.isFallback).toBe(true);
    expect(result.prediction).toMatchObject({
      prediction_method: "rule_based",
      model_version: null,
      fallback_used: true,
    });
    expect(result.prediction.modelConfidence).toBeUndefined();
    expect(result.prediction.confidenceInterval).toBeUndefined();
  });

  it("labels successful Python output with its model version", async () => {
    vi.spyOn(pythonDaemon, "predict").mockResolvedValue({
      riskScore: 12.3,
      riskCategory: "LOW",
      factors: [],
      clinicianAdvice: [],
      patientAdvice: [],
      model_version: "ab12cd34ef56ab78",
    });
    const result = await runAssessmentInference(patient);
    expect(result.isFallback).toBe(false);
    expect(result.prediction).toMatchObject({
      prediction_method: "ml_model",
      model_version: "ab12cd34ef56ab78",
      fallback_used: false,
    });
  });
});
