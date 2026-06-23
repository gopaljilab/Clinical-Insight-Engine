import { describe, it, expect } from "vitest";
import {
  RISK_CATEGORIES,
  errorSchemas,
  api,
  buildUrl,
  RiskCategoryFilter,
} from "./routes";
import { insertAssessmentSchema } from "./schema";

describe("routes", () => {
  describe("RISK_CATEGORIES constant", () => {
    it("contains LOW, MODERATE, HIGH", () => {
      expect(RISK_CATEGORIES).toContain("LOW");
      expect(RISK_CATEGORIES).toContain("MODERATE");
      expect(RISK_CATEGORIES).toContain("HIGH");
    });

    it("has exactly 3 values", () => {
      expect(RISK_CATEGORIES.length).toBe(3);
    });

    it("is a readonly tuple", () => {
      expect(Array.isArray(RISK_CATEGORIES)).toBe(true);
    });
  });

  describe("errorSchemas", () => {
    it("validation schema accepts message string and optional field", () => {
      const result = errorSchemas.validation.parse({ message: "Invalid input" });
      expect(result.message).toBe("Invalid input");
      expect(result.field).toBeUndefined();
    });

    it("validation schema accepts optional field", () => {
      const result = errorSchemas.validation.parse({ message: "Bad field", field: "email" });
      expect(result.field).toBe("email");
    });

    it("notFound schema requires message", () => {
      const result = errorSchemas.notFound.parse({ message: "Not found" });
      expect(result.message).toBe("Not found");
    });

    it("internal schema requires message", () => {
      const result = errorSchemas.internal.parse({ message: "Server error" });
      expect(result.message).toBe("Server error");
    });
  });

  describe("api.assessments routes", () => {
    it("create route has correct method and path", () => {
      expect(api.assessments.create.method).toBe("POST");
      expect(api.assessments.create.path).toBe("/api/assessments");
    });

    it("list route has correct method and path", () => {
      expect(api.assessments.list.method).toBe("GET");
      expect(api.assessments.list.path).toBe("/api/assessments");
    });

    it("search route has correct method and path", () => {
      expect(api.assessments.search.method).toBe("GET");
      expect(api.assessments.search.path).toBe("/api/assessments/search");
    });

    it("getById route has parameterized path", () => {
      expect(api.assessments.getById.path).toBe("/api/assessments/:id");
    });

    it("preview route has POST method", () => {
      expect(api.assessments.preview.method).toBe("POST");
    });

    it("cohort query route has GET method", () => {
      expect(api.assessments.cohort.query.method).toBe("GET");
      expect(api.assessments.cohort.query.path).toBe("/api/assessments/cohort");
    });
  });

  describe("buildUrl", () => {
    it("returns path unchanged with no params", () => {
      expect(buildUrl("/api/assessments")).toBe("/api/assessments");
    });

    it("replaces single path parameter", () => {
      expect(buildUrl("/api/assessments/:id", { id: 42 })).toBe("/api/assessments/42");
    });

    it("replaces multiple path parameters", () => {
      expect(buildUrl("/api/patients/:patientId/assessments/:id", { patientId: 7, id: 42 })).toBe(
        "/api/patients/7/assessments/42"
      );
    });

    it("coerces numeric params to string", () => {
      expect(buildUrl("/api/:id", { id: 101 })).toBe("/api/101");
    });

    it("leaves unmatched params in path", () => {
      const result = buildUrl("/api/:id", { id: 1, extra: "value" });
      expect(result).toBe("/api/1");
    });
  });
});

describe("insertAssessmentSchema", () => {
  const validInput = {
    gender: "Male",
    age: 45,
    hypertension: false,
    heartDisease: false,
    smokingHistory: "never",
    bmi: 24.5,
    hba1cLevel: 5.2,
    bloodGlucoseLevel: 95,
  };

  it("accepts valid Male assessment input", () => {
    const result = insertAssessmentSchema.parse(validInput);
    expect(result.gender).toBe("Male");
    expect(result.age).toBe(45);
  });

  it("accepts valid Female assessment input", () => {
    const result = insertAssessmentSchema.parse({ ...validInput, gender: "Female" });
    expect(result.gender).toBe("Female");
  });

  it("rejects gender outside Male/Female", () => {
    expect(() => insertAssessmentSchema.parse({ ...validInput, gender: "Other" })).toThrow();
  });

  it("rejects age below minimum", () => {
    expect(() => insertAssessmentSchema.parse({ ...validInput, age: 0 })).toThrow();
  });

  it("rejects age above maximum", () => {
    expect(() => insertAssessmentSchema.parse({ ...validInput, age: 121 })).toThrow();
  });

  it("rejects BMI below minimum", () => {
    expect(() => insertAssessmentSchema.parse({ ...validInput, bmi: 5 })).toThrow();
  });

  it("rejects BMI above maximum", () => {
    expect(() => insertAssessmentSchema.parse({ ...validInput, bmi: 65 })).toThrow();
  });

  it("rejects HbA1c below minimum", () => {
    expect(() => insertAssessmentSchema.parse({ ...validInput, hba1cLevel: 2 })).toThrow();
  });

  it("rejects blood glucose below minimum", () => {
    expect(() => insertAssessmentSchema.parse({ ...validInput, bloodGlucoseLevel: 40 })).toThrow();
  });

  it("accepts valid smoking history values", () => {
    for (const history of ["never", "current", "former", "No Info"]) {
      expect(() =>
        insertAssessmentSchema.parse({ ...validInput, smokingHistory: history })
      ).not.toThrow();
    }
  });

  it("rejects invalid smoking history", () => {
    expect(() =>
      insertAssessmentSchema.parse({ ...validInput, smokingHistory: "unknown" })
    ).toThrow();
  });
});
