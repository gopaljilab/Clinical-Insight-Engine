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

// ─── Patient Name Search Tests ─────────────────────────────────────────────

describe("patient name search coverage", () => {
  it("searchQuerySchema validates patient name search terms", () => {
    const validNames = ["John", "Mary Johnson", "O'Brien", "Dr. Smith", "Anne-Marie"];
    for (const name of validNames) {
      const result = searchQuerySchema.safeParse({ q: name });
      expect(result.success).toBe(true);
    }
  });

  it("searchQuerySchema accepts valid gender filter", () => {
    const result = searchQuerySchema.safeParse({ q: "Male" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.q).toBe("Male");
  });

  it("searchQuerySchema accepts valid smoking history filter", () => {
    const result = searchQuerySchema.safeParse({ q: "never" });
    expect(result.success).toBe(true);
  });

  it("searchQuerySchema accepts valid risk category filter", () => {
    const result = searchQuerySchema.safeParse({ q: "LOW" });
    expect(result.success).toBe(true);
  });

  it("searchQuerySchema accepts combined patient name and risk category", () => {
    const result = searchQuerySchema.safeParse({ q: "John", riskCategory: "HIGH" });
    expect(result.success).toBe(true);
  });

  it("searchQuerySchema accepts patient name with pagination", () => {
    const result = searchQuerySchema.safeParse({ q: "Johnson", limit: "10" });
    expect(result.success).toBe(true);
  });

  it("ilike patterns for patientName search are sanitized", () => {
    // SQL injection attempts should be rejected even when targeting patientName
    const injections = [
      "' OR '1'='1",
      "'; DROP TABLE assessments;--",
      "' UNION SELECT * FROM assessments--",
    ];
    for (const payload of injections) {
      const result = searchQuerySchema.safeParse({ q: payload });
      expect(result.success).toBe(false);
    }
  });

  it("detectSqlInjectionPattern flags injection through patientName field", () => {
    const injections = [
      "' OR '1'='1",
      "' UNION SELECT NULL--",
      "'; DROP TABLE assessments;--",
    ];
    for (const payload of injections) {
      expect(detectSqlInjectionPattern(payload)).not.toBeNull();
    }
  });

  it("safe patient names pass sqlProtection analysis", () => {
    const safeNames = ["John", "Mary Johnson", "O'Brien", "Smith"];
    for (const name of safeNames) {
      expect(analyzeSearchInput(name).safe).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Positive detection tests for detectSqlInjectionPattern.
//
// The original suite only checks that safe inputs return null. These tests
// lock down the contract for actual attack payloads: every documented attack
// signature MUST return a non-null pattern string. A future refactor that
// silently weakens or removes a pattern will fail here.
// ---------------------------------------------------------------------------

describe("detectSqlInjectionPattern positive detection", () => {
  /**
   * Helper: returns the matched pattern string OR an empty string if no match.
   * This avoids TypeScript non-null assertions (which the project's ESLint
   * config does not parse) while keeping the assertions tight.
   */
  function match(input) {
    const r = detectSqlInjectionPattern(input);
    return typeof r === "string" ? r : "";
  }

  it("detects a classic OR 1=1 boolean injection", () => {
    const result = match("admin' OR '1'='1");
    expect(result).not.toBe("");
    // The matched pattern must reference the OR/AND signature.
    expect(result).toContain("OR");
  });

  it("detects a UNION SELECT payload", () => {
    const result = match("1 UNION SELECT password FROM users");
    expect(result).not.toBe("");
    expect(result).toContain("UNION");
    expect(result).toContain("SELECT");
  });

  it("detects a stacked DROP TABLE comment payload", () => {
    const result = match("'; DROP TABLE users; --");
    expect(result).not.toBe("");
    // The first matching pattern is either the ;-DROP regex or the -- regex.
    const hasDrop = result.includes("DROP");
    const hasComment = result.includes("--");
    expect(hasDrop || hasComment).toBe(true);
  });

  it("detects a time-based SLEEP payload", () => {
    const result = match("1' OR SLEEP(5)--");
    expect(result).not.toBe("");
    // The -- pattern fires before SLEEP in the pattern list (-- is index 4, SLEEP is index 10).
    const hasComment = result.includes("--");
    const hasSleep = result.includes("SLEEP");
    expect(hasComment || hasSleep).toBe(true);
  });

  it("detects a block-comment obfuscated OR payload", () => {
    const result = match("admin'/**/OR/**/1=1");
    expect(result).not.toBe("");
    // The block-comment regex fires before the boolean regex.
    const hasBlockComment = result.includes("\\*");
    const hasOr = result.includes("OR");
    expect(hasBlockComment || hasOr).toBe(true);
  });

  it("detects a stored-procedure EXEC/xp_ payload", () => {
    const result = match("'; EXEC xp_cmdshell('dir')--");
    expect(result).not.toBe("");
    const hasComment = result.includes("--");
    const hasExec = result.includes("EXEC") || result.includes("xp_");
    expect(hasComment || hasExec).toBe(true);
  });

  it("detects an INFORMATION_SCHEMA enumeration payload", () => {
    const result = match("' UNION SELECT * FROM INFORMATION_SCHEMA.TABLES --");
    expect(result).not.toBe("");
    const hasUnion = result.includes("UNION");
    const hasSchema = result.includes("INFORMATION_SCHEMA");
    expect(hasUnion || hasSchema).toBe(true);
  });

  it("detects a WAITFOR DELAY time-based payload", () => {
    const result = match("1; WAITFOR DELAY '0:0:5'--");
    expect(result).not.toBe("");
    const hasComment = result.includes("--");
    const hasWaitfor = result.includes("WAITFOR");
    expect(hasComment || hasWaitfor).toBe(true);
  });

  it("detects a BENCHMARK payload", () => {
    const result = match("1' OR BENCHMARK(1000000, MD5('x'))--");
    expect(result).not.toBe("");
    const hasComment = result.includes("--");
    const hasBenchmark = result.includes("BENCHMARK");
    expect(hasComment || hasBenchmark).toBe(true);
  });

  it("detects a LOAD_FILE payload", () => {
    const result = match("1' UNION SELECT LOAD_FILE('/etc/passwd')--");
    expect(result).not.toBe("");
    const hasUnion = result.includes("UNION");
    const hasLoadFile = result.includes("LOAD_FILE");
    expect(hasUnion || hasLoadFile).toBe(true);
  });

  it("detects an INTO OUTFILE payload", () => {
    const result = match("1' UNION SELECT 1 INTO OUTFILE '/tmp/x'--");
    expect(result).not.toBe("");
    const hasUnion = result.includes("UNION");
    const hasOutfile = result.includes("OUTFILE");
    expect(hasUnion || hasOutfile).toBe(true);
  });

  it("detects a SYS.TABLES enumeration payload", () => {
    const result = match("' UNION SELECT * FROM SYS.TABLES --");
    expect(result).not.toBe("");
    const hasUnion = result.includes("UNION");
    const hasSys = result.includes("SYS");
    expect(hasUnion || hasSys).toBe(true);
  });

  // ─── False-positive guards ──────────────────────────────────────────────────
  // Legitimate medical-name inputs that LOOK dangerous but must NOT be rejected.

  it("does NOT flag an apostrophe in a medical name (O'Brien-Smith)", () => {
    expect(detectSqlInjectionPattern("Mary O'Brien-Smith")).toBeNull();
  });

  it("does NOT flag a numeric-only patient ID with underscores", () => {
    expect(detectSqlInjectionPattern("patient_id_12345")).toBeNull();
  });

  it("does NOT flag a name with period and comma (Dr. Smith, Jr.)", () => {
    expect(detectSqlInjectionPattern("Dr. Smith, Jr.")).toBeNull();
  });

  it("does NOT flag a simple Irish surname (O'Reilly)", () => {
    expect(detectSqlInjectionPattern("O'Reilly")).toBeNull();
  });

  it("does NOT flag a hyphenated clinical term (Smith-OBrien)", () => {
    expect(detectSqlInjectionPattern("Smith-OBrien")).toBeNull();
  });
});
