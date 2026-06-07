import { describe, expect, it } from "vitest";
import { insertAssessmentSchema } from "./schema";

const validAssessment = {
  patientName: "John Doe",
  gender: "Male" as const,
  age: 45,
  hypertension: false,
  heartDisease: false,
  smokingHistory: "never" as const,
  bmi: 24.5,
  hba1cLevel: 5.2,
  bloodGlucoseLevel: 95,
};

describe("insertAssessmentSchema", () => {
  it("accepts valid clinical assessment input", () => {
    const result = insertAssessmentSchema.safeParse(validAssessment);
    expect(result.success).toBe(true);
  });

  it("rejects age outside allowed clinical range", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      age: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/Age/i);
    }
  });

  it("rejects BMI outside allowed range", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      bmi: 5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/BMI/i);
    }
  });

  it("rejects invalid blood glucose values", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      bloodGlucoseLevel: 10,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/Blood glucose/i);
    }
  });

  it("rejects unknown smoking history values", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      smokingHistory: "unknown",
    });

    expect(result.success).toBe(false);
  });

  it("accepts missing patient name as optional", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      patientName: undefined,
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty age string with 'required' error", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      age: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Age is required");
    }
  });

  it("rejects empty BMI string with 'required' error", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      bmi: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("BMI is required");
    }
  });

  it("rejects empty HbA1c string with 'required' error", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      hba1cLevel: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("HbA1c level is required");
    }
  });

  it("rejects empty blood glucose string with 'required' error", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      bloodGlucoseLevel: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Blood glucose level is required");
    }
  });

  it("still accepts numeric age 0 as out-of-range (not 'required')", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      age: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Age must be at least 1");
    }
  });
});
