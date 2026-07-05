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
      expect(result.error.issues[0]?.message).toMatch(/greater than or equal to 1/);
    }
  });

  it("rejects BMI outside allowed range", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      bmi: 5,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/greater than or equal to 10/);
    }
  });

  it("rejects invalid blood glucose values", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      bloodGlucoseLevel: 10,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/greater than or equal to 50/);
    }
  });

  it("rejects unknown smoking history values", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      smokingHistory: "unknown",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing patient name as required", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      patientName: undefined,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Required");
    }
  });

  it("rejects empty age string with 'required' error", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      age: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Expected number, received string");
    }
  });

  it("rejects empty BMI string with 'required' error", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      bmi: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Expected number, received string");
    }
  });

  it("rejects empty HbA1c string with 'required' error", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      hba1cLevel: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Expected number, received string");
    }
  });

  it("rejects empty blood glucose string with 'required' error", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      bloodGlucoseLevel: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Expected number, received string");
    }
  });

  it("still accepts numeric age 0 as out-of-range (not 'required')", () => {
    const result = insertAssessmentSchema.safeParse({
      ...validAssessment,
      age: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Number must be greater than or equal to 1");
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