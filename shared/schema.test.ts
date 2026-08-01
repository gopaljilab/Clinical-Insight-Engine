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
    const invalidAssessment = { ...validAssessment, age: 0 };
    const result = insertAssessmentSchema.safeParse(invalidAssessment);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/must be at least 1/i);
    }
  });

  it("rejects BMI outside allowed range", () => {
    const invalidAssessment = { ...validAssessment, bmi: 5 };
    const result = insertAssessmentSchema.safeParse(invalidAssessment);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/must be at least 10/i);
    }
  });

  it("rejects invalid blood glucose values", () => {
    const invalidAssessment = { ...validAssessment, bloodGlucoseLevel: 10 };
    const result = insertAssessmentSchema.safeParse(invalidAssessment);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/must be at least 50/i);
    }
  });

  it("rejects unknown smoking history values", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      smokingHistory: "unknown",
    });

    expect(result.success).toBe(false);
  });

  it("accepts missing patient name as it is optional", () => {
    const { patientName, ...invalidAssessment } = validAssessment;
    const result = insertAssessmentSchema.safeParse(invalidAssessment);

    expect(result.success).toBe(true);
  });

  it("rejects empty age string with 'required' error", () => {
    const invalidAssessment = { ...validAssessment, age: "" as any };
    const result = insertAssessmentSchema.safeParse(invalidAssessment);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/Expected number, received string|is required/i);
    }
  });

  it("rejects empty BMI string with 'required' error", () => {
    const invalidAssessment = { ...validAssessment, bmi: "" as any };
    const result = insertAssessmentSchema.safeParse(invalidAssessment);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/Expected number, received string|is required/i);
    }
  });

  it("rejects empty HbA1c string with 'required' error", () => {
    const invalidAssessment = { ...validAssessment, hba1cLevel: "" as any };
    const result = insertAssessmentSchema.safeParse(invalidAssessment);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/Expected number, received string|is required/i);
    }
  });

  it("rejects empty blood glucose string with 'required' error", () => {
    const invalidAssessment = { ...validAssessment, bloodGlucoseLevel: "" as any };
    const result = insertAssessmentSchema.safeParse(invalidAssessment);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/Expected number, received string|is required/i);
    }
  });

  it("still accepts numeric age 0 as out-of-range (not 'required')", () => {
    const invalidAssessment = { ...validAssessment, age: 0 };
    const result = insertAssessmentSchema.safeParse(invalidAssessment);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/must be at least 1/i);
    }
  });
});
it("rejects whitespace-only patient name", () => {
  const result = insertAssessmentSchema.safeParse({
    ...validAssessment,
    patientName: "     ",
  });

  expect(result.success).toBe(false);
});

it("accepts patient name at minimum valid length", () => {
  const result = insertAssessmentSchema.safeParse({
    ...validAssessment,
    patientName: "A",
  });

  expect(result.success).toBe(true);
});

it("accepts special characters in patient name", () => {
  const result = insertAssessmentSchema.safeParse({
    ...validAssessment,
    patientName: "John O'Connor-Smith",
  });

  expect(result.success).toBe(true);
});

it("rejects invalid gender value", () => {
  const result = insertAssessmentSchema.safeParse({
    ...validAssessment,
    gender: "Unknown",
  });

  expect(result.success).toBe(false);
});

it("rejects extremely large age value", () => {
  const result = insertAssessmentSchema.safeParse({
    ...validAssessment,
    age: 999999,
  });

  expect(result.success).toBe(false);
});


