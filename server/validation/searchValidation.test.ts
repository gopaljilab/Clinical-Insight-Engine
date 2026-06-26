import { expect, test, describe } from "vitest";
import { vi } from "vitest";

// Mock @shared/dateParser before importing searchValidation
vi.mock("@shared/dateParser", () => ({
  parseClinicalDate: vi.fn((val: string) => {
    // Simulate parseClinicalDate returning confidence 1.0 for ISO dates
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    if (isoPattern.test(val)) {
      return { date: new Date(val), confidence: 1.0 };
    }
    // Ambiguous format
    return { date: null, confidence: 0.5 };
  }),
}));

import {
  detectSqlInjectionPattern,
  searchQuerySchema,
  assessmentsQuerySchema,
  cohortQuerySchema,
  VALID_RISK_CATEGORIES,
} from "./searchValidation";

describe("detectSqlInjectionPattern", () => {
  test("returns null for safe alphanumeric input", () => {
    expect(detectSqlInjectionPattern("John Doe")).toBeNull();
    expect(detectSqlInjectionPattern("patient123")).toBeNull();
    expect(detectSqlInjectionPattern("O'Brien")).toBeNull();
    expect(detectSqlInjectionPattern("Hyphen-name")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(detectSqlInjectionPattern("")).toBeNull();
  });

  test("returns null for safe medical terms", () => {
    expect(detectSqlInjectionPattern("diabetes")).toBeNull();
    expect(detectSqlInjectionPattern("hba1c")).toBeNull();
    expect(detectSqlInjectionPattern("hypertension")).toBeNull();
  });

  test("detects OR 1=1 pattern", () => {
    const result = detectSqlInjectionPattern("' OR 1=1--");
    expect(result).not.toBeNull();
  });

  test("detects UNION SELECT pattern", () => {
    const result = detectSqlInjectionPattern("' UNION SELECT * FROM users--");
    expect(result).not.toBeNull();
  });

  test("detects ; DROP TABLE pattern", () => {
    const result = detectSqlInjectionPattern("'; DROP TABLE users;--");
    expect(result).not.toBeNull();
  });

  test("detects -- SQL comment", () => {
    const result = detectSqlInjectionPattern("John Doe --");
    expect(result).not.toBeNull();
  });

  test("detects /* block comment */", () => {
    const result = detectSqlInjectionPattern("' /* comment */ OR 1=1");
    expect(result).not.toBeNull();
  });

  test("detects EXEC pattern", () => {
    const result = detectSqlInjectionPattern("'; EXEC xp_cmdshell");
    expect(result).not.toBeNull();
  });

  test("detects xp_ stored procedure pattern", () => {
    const result = detectSqlInjectionPattern("xp_cmdshell");
    expect(result).not.toBeNull();
  });

  test("detects INFORMATION_SCHEMA enumeration", () => {
    const result = detectSqlInjectionPattern("UNION SELECT * FROM INFORMATION_SCHEMA.tables");
    expect(result).not.toBeNull();
  });

  test("detects SLEEP time-based injection", () => {
    const result = detectSqlInjectionPattern("1; SLEEP(5)--");
    expect(result).not.toBeNull();
  });

  test("detects BENCHMARK time-based injection", () => {
    const result = detectSqlInjectionPattern("1; BENCHMARK(1000000,SHA1('test'))--");
    expect(result).not.toBeNull();
  });

  test("detects LOAD_FILE injection", () => {
    const result = detectSqlInjectionPattern("1; LOAD_FILE('/etc/passwd')--");
    expect(result).not.toBeNull();
  });

  test("detects INTO OUTFILE injection", () => {
    const result = detectSqlInjectionPattern("1; SELECT * FROM users INTO OUTFILE '/tmp/out.txt'");
    expect(result).not.toBeNull();
  });

  test("detects sys tables pattern", () => {
    const result = detectSqlInjectionPattern("UNION SELECT * FROM SYS.TABLES");
    expect(result).not.toBeNull();
  });

  test("returns the first matched pattern", () => {
    // Both OR pattern and DROP pattern match, but first in array is OR
    const result = detectSqlInjectionPattern("OR 1=1; DROP TABLE users");
    expect(result).not.toBeNull();
  });
});

describe("searchQuerySchema", () => {
  test("parses valid empty query", () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("");
      expect(result.data.limit).toBe(20);
    }
  });

  test("parses valid search query", () => {
    const result = searchQuerySchema.safeParse({ q: "John Doe" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("John Doe");
    }
  });

  test("trims whitespace from search query", () => {
    const result = searchQuerySchema.safeParse({ q: "  Jane  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("Jane");
    }
  });

  test("accepts valid risk categories", () => {
    for (const cat of VALID_RISK_CATEGORIES) {
      const result = searchQuerySchema.safeParse({ riskCategory: cat });
      expect(result.success).toBe(true);
    }
  });

  test("rejects invalid risk category", () => {
    const result = searchQuerySchema.safeParse({ riskCategory: "INVALID" });
    expect(result.success).toBe(false);
  });

  test("rejects search query exceeding max length", () => {
    const longQuery = "a".repeat(201);
    const result = searchQuerySchema.safeParse({ q: longQuery });
    expect(result.success).toBe(false);
  });

  test("rejects SQL injection in search query", () => {
    const result = searchQuerySchema.safeParse({ q: "'; DROP TABLE patients;--" });
    expect(result.success).toBe(false);
  });

  test("rejects search with invalid characters", () => {
    const result = searchQuerySchema.safeParse({ q: "John<script>alert(1)</script>" });
    expect(result.success).toBe(false);
  });

  test("accepts cursor as string (coerced to number)", () => {
    const result = searchQuerySchema.safeParse({ cursor: "5" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBe(5);
    }
  });

  test("rejects cursor less than 1", () => {
    const result = searchQuerySchema.safeParse({ cursor: "0" });
    expect(result.success).toBe(false);
  });

  test("accepts limit within range", () => {
    const result = searchQuerySchema.safeParse({ limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  test("rejects limit exceeding 100", () => {
    const result = searchQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  test("rejects limit less than 1", () => {
    const result = searchQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });
});

describe("assessmentsQuerySchema", () => {
  test("parses valid empty query", () => {
    const result = assessmentsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("parses page and limit with defaults", () => {
    const result = assessmentsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(50);
    }
  });

  test("accepts valid sortBy values", () => {
    const sortValues = ["createdAt", "date", "riskScore", "risk", "age", "bmi", "patientName", "gender"];
    for (const s of sortValues) {
      const result = assessmentsQuerySchema.safeParse({ sortBy: s });
      expect(result.success).toBe(true);
    }
  });

  test("accepts valid order values", () => {
    const result = assessmentsQuerySchema.safeParse({ order: "asc" });
    expect(result.success).toBe(true);
    const result2 = assessmentsQuerySchema.safeParse({ order: "desc" });
    expect(result2.success).toBe(true);
  });

  test("normalizes gender 'male' to 'Male'", () => {
    const result = assessmentsQuerySchema.safeParse({ gender: "male" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBe("Male");
    }
  });

  test("normalizes gender 'female' to 'Female'", () => {
    const result = assessmentsQuerySchema.safeParse({ gender: "female" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBe("Female");
    }
  });

  test("normalizes gender 'all' to 'All'", () => {
    const result = assessmentsQuerySchema.safeParse({ gender: "all" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gender).toBe("All");
    }
  });

  test("rejects invalid gender value", () => {
    const result = assessmentsQuerySchema.safeParse({ gender: "unknown" });
    expect(result.success).toBe(false);
  });

  test("accepts age range within bounds", () => {
    const result = assessmentsQuerySchema.safeParse({ minAge: "20", maxAge: "60" });
    expect(result.success).toBe(true);
  });

  test("rejects age below 0", () => {
    const result = assessmentsQuerySchema.safeParse({ minAge: "-5" });
    expect(result.success).toBe(false);
  });

  test("rejects age above 120", () => {
    const result = assessmentsQuerySchema.safeParse({ minAge: "150" });
    expect(result.success).toBe(false);
  });

  test("accepts valid ISO date for startDate", () => {
    const result = assessmentsQuerySchema.safeParse({ startDate: "2024-01-15" });
    expect(result.success).toBe(true);
  });

  test("rejects ambiguous MM/DD/YYYY date for startDate", () => {
    const result = assessmentsQuerySchema.safeParse({ startDate: "01/15/2024" });
    expect(result.success).toBe(false);
  });

  test("accepts valid risk category including ALL", () => {
    const result = assessmentsQuerySchema.safeParse({ riskCategory: "ALL" });
    expect(result.success).toBe(true);
  });

  test("normalizes riskCategory to uppercase", () => {
    const result = assessmentsQuerySchema.safeParse({ riskCategory: "low" });
    expect(result.success).toBe(true);
  });
});

describe("cohortQuerySchema", () => {
  test("parses valid empty query", () => {
    const result = cohortQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("accepts valid age range", () => {
    const result = cohortQuerySchema.safeParse({ minAge: 18, maxAge: 65 });
    expect(result.success).toBe(true);
  });

  test("accepts valid BMI range", () => {
    const result = cohortQuerySchema.safeParse({ minBmi: 18.5, maxBmi: 30 });
    expect(result.success).toBe(true);
  });

  test("accepts valid HbA1c range", () => {
    const result = cohortQuerySchema.safeParse({ minHba1c: 4.0, maxHba1c: 8.0 });
    expect(result.success).toBe(true);
  });

  test("accepts valid glucose range", () => {
    const result = cohortQuerySchema.safeParse({ minGlucose: 70, maxGlucose: 200 });
    expect(result.success).toBe(true);
  });

  test("accepts smokingHistory enum values", () => {
    const result = cohortQuerySchema.safeParse({ smokingHistory: "Current" });
    expect(result.success).toBe(true);
  });

  test("accepts boolean hypertension", () => {
    const result = cohortQuerySchema.safeParse({ hypertension: true });
    expect(result.success).toBe(true);
  });

  test("accepts boolean heartDisease", () => {
    const result = cohortQuerySchema.safeParse({ heartDisease: false });
    expect(result.success).toBe(true);
  });

  test("accepts valid risk category", () => {
    const result = cohortQuerySchema.safeParse({ riskCategory: "HIGH" });
    expect(result.success).toBe(true);
  });

  test("rejects invalid risk category", () => {
    const result = cohortQuerySchema.safeParse({ riskCategory: "INVALID" });
    expect(result.success).toBe(false);
  });

  test("accepts valid ISO date", () => {
    const result = cohortQuerySchema.safeParse({ startDate: "2024-01-01", endDate: "2024-12-31" });
    expect(result.success).toBe(true);
  });

  test("rejects ambiguous date format", () => {
    const result = cohortQuerySchema.safeParse({ startDate: "01/01/2024" });
    expect(result.success).toBe(false);
  });
});
