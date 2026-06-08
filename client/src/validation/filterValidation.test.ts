/**
 * filterValidation.test.ts
 *
 * Unit tests for the client-side SQL injection and XSS validation utilities.
 * These tests verify the fix for Issue #743 (SQL Injection Vulnerability in Patient Name Search).
 */

import { describe, it, expect } from "vitest";
import {
  validateFilterInput,
  validateSearchInput,
  detectClientSqlInjection,
} from "./filterValidation";

// ---------------------------------------------------------------------------
// detectClientSqlInjection
// ---------------------------------------------------------------------------
describe("detectClientSqlInjection", () => {
  it("returns null for a clean patient name", () => {
    expect(detectClientSqlInjection("John Doe")).toBeNull();
    expect(detectClientSqlInjection("O'Brien")).toBeNull(); // apostrophe in name is fine
    expect(detectClientSqlInjection("Mary-Jane")).toBeNull();
  });

  it("detects OR 1=1 (the exact payload from Issue #743)", () => {
    expect(detectClientSqlInjection("' OR 1=1 --")).not.toBeNull();
    expect(detectClientSqlInjection("OR 1=1")).not.toBeNull();
    expect(detectClientSqlInjection("1 OR 1=1")).not.toBeNull();
  });

  it("detects SQL line comment (--)", () => {
    // Fix for Issue #743: the old pattern /--\\s*$/m missed trailing spaces
    expect(detectClientSqlInjection("admin'--")).not.toBeNull();
    expect(detectClientSqlInjection("' OR 1=1 -- ")).not.toBeNull(); // trailing space after --
    expect(detectClientSqlInjection("test--")).not.toBeNull();
  });

  it("detects UNION SELECT", () => {
    expect(detectClientSqlInjection("UNION SELECT * FROM users")).not.toBeNull();
    expect(detectClientSqlInjection("UNION ALL SELECT password FROM users")).not.toBeNull();
  });

  it("detects DROP TABLE", () => {
    expect(detectClientSqlInjection("; DROP TABLE assessments")).not.toBeNull();
    expect(detectClientSqlInjection("x; DELETE FROM users")).not.toBeNull();
  });

  it("detects block comment injection", () => {
    expect(detectClientSqlInjection("admin'/*comment*/OR'1'='1")).not.toBeNull();
  });

  it("detects SELECT FROM", () => {
    expect(detectClientSqlInjection("SELECT * FROM patients")).not.toBeNull();
  });

  it("detects time-based blind injection", () => {
    expect(detectClientSqlInjection("'; SLEEP(5)--")).not.toBeNull();
    expect(detectClientSqlInjection("1; WAITFOR DELAY '0:0:5'--")).not.toBeNull();
  });

  it("detects schema enumeration", () => {
    expect(detectClientSqlInjection("INFORMATION_SCHEMA.tables")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateSearchInput
// ---------------------------------------------------------------------------
describe("validateSearchInput", () => {
  it("returns the trimmed input for safe patient names", () => {
    expect(validateSearchInput("Jane Smith")).toBe("Jane Smith");
    expect(validateSearchInput("  John Doe  ")).toBe("John Doe");
    expect(validateSearchInput("O'Brien")).toBe("O'Brien");
  });

  it("returns empty string for null or undefined", () => {
    expect(validateSearchInput(null)).toBe("");
    expect(validateSearchInput(undefined)).toBe("");
    expect(validateSearchInput("")).toBe("");
  });

  it("blocks the exact payload from Issue #743: ' OR 1=1 --", () => {
    const rejected: string[] = [];
    const result = validateSearchInput("' OR 1=1 --", (reason) => rejected.push(reason));
    expect(result).toBe("");
    expect(rejected.length).toBeGreaterThan(0);
  });

  it("blocks OR 1=1 variants", () => {
    expect(validateSearchInput("OR 1=1")).toBe("");
    expect(validateSearchInput("' OR '1'='1")).toBe("");
  });

  it("blocks UNION SELECT", () => {
    expect(validateSearchInput("UNION SELECT password FROM users")).toBe("");
  });

  it("blocks SQL line comments", () => {
    expect(validateSearchInput("admin'--")).toBe("");
    expect(validateSearchInput("test -- ")).toBe("");
  });

  it("blocks DROP TABLE", () => {
    expect(validateSearchInput("; DROP TABLE patients")).toBe("");
  });

  it("blocks XSS payloads", () => {
    expect(validateSearchInput("<script>alert(1)</script>")).toBe("");
    expect(validateSearchInput("javascript:alert(1)")).toBe("");
  });

  it("calls onRejected callback when input is rejected", () => {
    let called = false;
    let reason = "";
    validateSearchInput("' OR 1=1 --", (r) => {
      called = true;
      reason = r;
    });
    expect(called).toBe(true);
    expect(reason).toBeTruthy();
  });

  it("truncates input exceeding 200 characters", () => {
    const longInput = "a".repeat(300);
    const result = validateSearchInput(longInput);
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("rejects input with disallowed special characters", () => {
    // Characters like | < > { } are not in the allowlist
    expect(validateSearchInput("test|injection")).toBe("");
    expect(validateSearchInput("test<injection>")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// validateFilterInput (existing behaviour, no regression)
// ---------------------------------------------------------------------------
describe("validateFilterInput (backwards compatibility)", () => {
  it("returns the input for safe strings", () => {
    expect(validateFilterInput("some filter")).toBe("some filter");
  });

  it("blocks XSS patterns", () => {
    expect(validateFilterInput("<script>alert(1)</script>")).toBe("");
    expect(validateFilterInput("<iframe src='evil'></iframe>")).toBe("");
  });

  it("returns empty string for null/undefined", () => {
    expect(validateFilterInput(null)).toBe("");
    expect(validateFilterInput(undefined)).toBe("");
  });

  it("truncates to 200 characters", () => {
    expect(validateFilterInput("x".repeat(300)).length).toBeLessThanOrEqual(200);
  });
});
