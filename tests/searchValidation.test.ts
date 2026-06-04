/**
 * searchValidation.test.ts
 *
 * Security-focused tests for the patient/assessment search validation layer.
 *
 * Test matrix:
 * ┌─────────────────────────────────────┬──────────────────────────────────┐
 * │ Scenario                            │ Expected outcome                 │
 * ├─────────────────────────────────────┼──────────────────────────────────┤
 * │ Normal text search                  │ Passes validation                │
 * │ Medical name with apostrophe        │ Passes validation                │
 * │ Empty query                         │ Passes validation (returns all)  │
 * │ Boolean injection (' OR '1'='1)     │ Rejected + injection detected    │
 * │ UNION SELECT payload                │ Rejected + injection detected    │
 * │ DROP TABLE comment payload          │ Rejected + injection detected    │
 * │ Comment-based payload (--)          │ Rejected + injection detected    │
 * │ Time-based injection (SLEEP)        │ Rejected + injection detected    │
 * │ Schema enumeration (INFORMATION_SCHEMA) │ Rejected + injection detected│
 * │ Over-length query (201 chars)       │ Rejected (length exceeded)       │
 * │ Exact max-length query (200 chars)  │ Passes validation                │
 * │ Invalid characters (<, >, ;, =)     │ Rejected (character set)         │
 * │ Valid risk category filter          │ Passes validation                │
 * │ Invalid risk category               │ Rejected                         │
 * │ Valid pagination params             │ Passes validation                │
 * │ Over-limit page size (>100)         │ Rejected                         │
 * │ Non-numeric page                    │ Rejected                         │
 * └─────────────────────────────────────┴──────────────────────────────────┘
 */

import { describe, expect, it } from "vitest";
import {
  searchQuerySchema,
  detectSqlInjectionPattern,
  VALID_RISK_CATEGORIES,
} from "../server/validation/searchValidation";
import {
  analyzeSearchInput,
  sanitizeDatabaseError,
} from "../server/security/sqlProtection";

// ─── detectSqlInjectionPattern Unit Tests ──────────────────────────────────

describe("detectSqlInjectionPattern", () => {
  it("returns null for a safe alphanumeric string", () => {
    expect(detectSqlInjectionPattern("John Smith")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(detectSqlInjectionPattern("")).toBeNull();
  });

  it("returns null for a name with an apostrophe (O'Brien)", () => {
    expect(detectSqlInjectionPattern("O'Brien")).toBeNull();
  });

  it("detects boolean-based injection: ' OR '1'='1", () => {
    const result = detectSqlInjectionPattern("' OR '1'='1");
    expect(result).not.toBeNull();
  });

  it("detects boolean-based injection: ' AND '1'='1", () => {
    const result = detectSqlInjectionPattern("' AND '1'='1");
    expect(result).not.toBeNull();
  });

  it("detects UNION SELECT payload", () => {
    const result = detectSqlInjectionPattern("' UNION SELECT NULL--");
    expect(result).not.toBeNull();
  });

  it("detects UNION ALL SELECT payload", () => {
    const result = detectSqlInjectionPattern("x UNION ALL SELECT 1,2,3--");
    expect(result).not.toBeNull();
  });

  it("detects DROP TABLE payload with semicolon", () => {
    const result = detectSqlInjectionPattern("'; DROP TABLE patients;--");
    expect(result).not.toBeNull();
  });

  it("detects SQL line comment (--)", () => {
    const result = detectSqlInjectionPattern("x--");
    expect(result).not.toBeNull();
  });

  it("detects block comment (/* ... */)", () => {
    const result = detectSqlInjectionPattern("x /* comment */ OR 1=1");
    expect(result).not.toBeNull();
  });

  it("detects SLEEP() time-based injection", () => {
    const result = detectSqlInjectionPattern("'; SLEEP(5)--");
    expect(result).not.toBeNull();
  });

  it("detects WAITFOR DELAY (MSSQL time-based)", () => {
    const result = detectSqlInjectionPattern("'; WAITFOR DELAY '0:0:5'--");
    expect(result).not.toBeNull();
  });

  it("detects INFORMATION_SCHEMA enumeration", () => {
    const result = detectSqlInjectionPattern("' UNION SELECT table_name FROM INFORMATION_SCHEMA.TABLES--");
    expect(result).not.toBeNull();
  });

  it("detects xp_ stored procedure call", () => {
    const result = detectSqlInjectionPattern("'; EXEC xp_cmdshell('dir')--");
    expect(result).not.toBeNull();
  });
});

// ─── analyzeSearchInput Tests ──────────────────────────────────────────────

describe("analyzeSearchInput", () => {
  it("returns safe:true for a normal search term", () => {
    const result = analyzeSearchInput("diabetes");
    expect(result.safe).toBe(true);
  });

  it("returns safe:false and includes pattern for UNION payload", () => {
    const result = analyzeSearchInput("' UNION SELECT NULL--");
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.pattern).toBeTruthy();
    }
  });

  it("returns safe:false for boolean injection", () => {
    const result = analyzeSearchInput("admin' OR '1'='1");
    expect(result.safe).toBe(false);
  });
});

// ─── searchQuerySchema Validation Tests ───────────────────────────────────

describe("searchQuerySchema — normal queries", () => {
  it("Scenario 1: accepts a normal text search term", () => {
    const result = searchQuerySchema.safeParse({ q: "Smith" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("Smith");
    }
  });

  it("accepts a medical name with an apostrophe (O'Brien)", () => {
    const result = searchQuerySchema.safeParse({ q: "O'Brien" });
    expect(result.success).toBe(true);
  });

  it("Scenario 5: accepts an empty query string gracefully", () => {
    const result = searchQuerySchema.safeParse({ q: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("");
    }
  });

  it("accepts a missing q param (no search term)", () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("");
    }
  });

  it("trims whitespace from query", () => {
    const result = searchQuerySchema.safeParse({ q: "  Smith  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("Smith");
    }
  });

  it("accepts exactly 200 characters (max boundary)", () => {
    const q = "a".repeat(200);
    const result = searchQuerySchema.safeParse({ q });
    expect(result.success).toBe(true);
  });
});

describe("searchQuerySchema — SQL injection payloads rejected", () => {
  it("Scenario 2: rejects boolean injection ' OR '1'='1", () => {
    const result = searchQuerySchema.safeParse({ q: "' OR '1'='1" });
    expect(result.success).toBe(false);
  });

  it("Scenario 3: rejects UNION SELECT payload", () => {
    const result = searchQuerySchema.safeParse({ q: "' UNION SELECT NULL--" });
    expect(result.success).toBe(false);
  });

  it("rejects DROP TABLE payload", () => {
    const result = searchQuerySchema.safeParse({ q: "'; DROP TABLE patients;--" });
    expect(result.success).toBe(false);
  });

  it("rejects INFORMATION_SCHEMA enumeration", () => {
    const result = searchQuerySchema.safeParse({ q: "' UNION SELECT table_name FROM INFORMATION_SCHEMA.TABLES--" });
    expect(result.success).toBe(false);
  });

  it("rejects time-based injection SLEEP(5)", () => {
    const result = searchQuerySchema.safeParse({ q: "'; SLEEP(5)--" });
    expect(result.success).toBe(false);
  });
});

describe("searchQuerySchema — special characters", () => {
  it("Scenario 4: rejects query with < > = ; characters", () => {
    // These are blocked by the allowed-character regex
    const inputs = ["<script>", "name=value", "a;b", "x>1"];
    for (const q of inputs) {
      const result = searchQuerySchema.safeParse({ q });
      expect(result.success).toBe(false);
    }
  });

  it("accepts hyphens (used in medical terms)", () => {
    const result = searchQuerySchema.safeParse({ q: "non-smoker" });
    expect(result.success).toBe(true);
  });

  it("accepts periods (used in abbreviations)", () => {
    const result = searchQuerySchema.safeParse({ q: "Dr. Smith" });
    expect(result.success).toBe(true);
  });
});

describe("searchQuerySchema — length validation", () => {
  it("rejects a 201-character query (over max)", () => {
    const q = "a".repeat(201);
    const result = searchQuerySchema.safeParse({ q });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/200/);
    }
  });
});

describe("searchQuerySchema — riskCategory filter", () => {
  it.each(VALID_RISK_CATEGORIES)("accepts valid risk category: %s", (cat) => {
    const result = searchQuerySchema.safeParse({ riskCategory: cat });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskCategory).toBe(cat);
    }
  });

  it("rejects an invalid risk category", () => {
    const result = searchQuerySchema.safeParse({ riskCategory: "CRITICAL" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toMatch(/LOW|MODERATE|HIGH/);
    }
  });
});

describe("searchQuerySchema — pagination params", () => {
  it("uses default limit=20 and undefined cursor when not provided", () => {
    const result = searchQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBeUndefined();
      expect(result.data.limit).toBe(20);
    }
  });

  it("accepts valid cursor and limit values", () => {
    const result = searchQuerySchema.safeParse({ cursor: "123", limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBe(123);
      expect(result.data.limit).toBe(50);
    }
  });

  it("rejects limit > 100", () => {
    const result = searchQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric cursor", () => {
    const result = searchQuerySchema.safeParse({ cursor: "abc" });
    expect(result.success).toBe(false);
  });
});

// ─── sanitizeDatabaseError Tests ──────────────────────────────────────────

describe("sanitizeDatabaseError", () => {
  it("maps unique_violation (23505) to 409 with generic message", () => {
    const { statusCode, message } = sanitizeDatabaseError({ code: "23505" });
    expect(statusCode).toBe(409);
    expect(message).not.toMatch(/23505/);
    expect(message).not.toMatch(/unique/i);
  });

  it("maps syntax_error (42601) to 500 with generic message", () => {
    const { statusCode, message } = sanitizeDatabaseError({ code: "42601" });
    expect(statusCode).toBe(500);
    // Must not expose SQL syntax information
    expect(message).not.toMatch(/syntax/i);
    expect(message).not.toMatch(/42601/);
  });

  it("maps undefined_table (42P01) to 500 with generic message", () => {
    const { statusCode, message } = sanitizeDatabaseError({ code: "42P01" });
    expect(statusCode).toBe(500);
    expect(message).not.toMatch(/table/i);
  });

  it("returns 500 for unknown errors", () => {
    const { statusCode, message } = sanitizeDatabaseError(new Error("something failed"));
    expect(statusCode).toBe(500);
    expect(message).toBe("An unexpected error occurred.");
  });

  it("returns 500 for null errors", () => {
    const { statusCode, message } = sanitizeDatabaseError(null);
    expect(statusCode).toBe(500);
  });

  it("never exposes raw error messages in the sanitized output", () => {
    const rawError = { code: "42601", message: "syntax error at or near \"DROP\"" };
    const { message } = sanitizeDatabaseError(rawError);
    expect(message).not.toContain("DROP");
    expect(message).not.toContain("syntax error");
  });
});
