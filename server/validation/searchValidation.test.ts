import { describe, it, expect } from "vitest";
import {
  detectSqlInjectionPattern,
  searchQuerySchema,
  assessmentsQuerySchema,
  VALID_RISK_CATEGORIES,
} from "./searchValidation";

const MAX_SEARCH_LENGTH = 200;

describe("searchValidation", () => {
  describe("detectSqlInjectionPattern", () => {
    it("returns null for plain alphanumeric search", () => {
      expect(detectSqlInjectionPattern("John Doe")).toBeNull();
    });

    it("returns null for hyphenated medical terms", () => {
      expect(detectSqlInjectionPattern("HbA1c-level")).toBeNull();
    });

    it("rejects OR 1=1 pattern", () => {
      expect(detectSqlInjectionPattern("' OR '1'='1")).not.toBeNull();
    });

    it("rejects UNION SELECT pattern", () => {
      expect(detectSqlInjectionPattern("UNION SELECT password FROM users")).not.toBeNull();
    });

    it("rejects DROP TABLE statement", () => {
      expect(detectSqlInjectionPattern("Patient'; DROP TABLE patients;--")).not.toBeNull();
    });

    it("rejects SQL line comment", () => {
      expect(detectSqlInjectionPattern("John Doe --")).not.toBeNull();
    });

    it("rejects block comment injection", () => {
      expect(detectSqlInjectionPattern("Patient /* hidden */")).not.toBeNull();
    });

    it("rejects SLEEP time-based injection", () => {
      expect(detectSqlInjectionPattern("John'; SLEEP(5);--")).not.toBeNull();
    });

    it("rejects INFORMATION_SCHEMA enumeration", () => {
      expect(detectSqlInjectionPattern("SELECT * FROM INFORMATION_SCHEMA.tables")).not.toBeNull();
    });

    it("rejects xp_ stored procedure", () => {
      expect(detectSqlInjectionPattern("EXEC xp_cmdshell")).not.toBeNull();
    });

    it("rejects AND condition pattern", () => {
      expect(detectSqlInjectionPattern("' AND '1'='1")).not.toBeNull();
    });
  });

  describe("searchQuerySchema", () => {
    it("accepts empty query (no params)", () => {
      const result = searchQuerySchema.parse({});
      expect(result.q).toBe("");
    });

    it("accepts valid plain-text search term", () => {
      const result = searchQuerySchema.parse({ q: "John Doe" });
      expect(result.q).toBe("John Doe");
    });

    it("accepts alphanumeric-only search", () => {
      const result = searchQuerySchema.parse({ q: "Patient123" });
      expect(result.q).toBe("Patient123");
    });

    it("accepts valid risk category", () => {
      const result = searchQuerySchema.parse({ riskCategory: "HIGH" });
      expect(result.riskCategory).toBe("HIGH");
    });

    it("rejects risk category outside VALID_RISK_CATEGORIES", () => {
      expect(() => searchQuerySchema.parse({ riskCategory: "CRITICAL" })).toThrow();
    });

    it("accepts limit within range", () => {
      const result = searchQuerySchema.parse({ limit: 50 });
      expect(result.limit).toBe(50);
    });

    it("rejects limit exceeding maximum", () => {
      expect(() => searchQuerySchema.parse({ limit: 200 })).toThrow();
    });

    it("rejects limit below minimum", () => {
      expect(() => searchQuerySchema.parse({ limit: 0 })).toThrow();
    });

    it("rejects search query exceeding MAX_SEARCH_LENGTH", () => {
      const longQuery = "a".repeat(MAX_SEARCH_LENGTH + 1); // 201 chars
      expect(() => searchQuerySchema.parse({ q: longQuery })).toThrow();
    });

    it("trims whitespace from search query", () => {
      const result = searchQuerySchema.parse({ q: "  Patient Name  " });
      expect(result.q).toBe("Patient Name");
    });

    it("rejects SQL injection via search query", () => {
      expect(() => searchQuerySchema.parse({ q: "Patient' OR '1'='1" })).toThrow();
    });
  });

  describe("VALID_RISK_CATEGORIES constant", () => {
    it("contains LOW, MODERATE, HIGH", () => {
      expect(VALID_RISK_CATEGORIES).toContain("LOW");
      expect(VALID_RISK_CATEGORIES).toContain("MODERATE");
      expect(VALID_RISK_CATEGORIES).toContain("HIGH");
    });

    it("has exactly 3 values", () => {
      expect(VALID_RISK_CATEGORIES.length).toBe(3);
    });
  });
});
