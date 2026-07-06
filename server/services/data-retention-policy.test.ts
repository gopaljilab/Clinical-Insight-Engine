import { describe, expect, it } from "vitest";
import {
  getRetentionDecision,
  getRetentionPolicyConfig,
  isRetentionEligible,
} from "./data-retention-policy";

describe("data retention policy", () => {
  it("loads defaults and ignores invalid environment overrides", () => {
    const config = getRetentionPolicyConfig({
      ASSESSMENT_RETENTION_DAYS: "not-a-number",
      PATIENT_RETENTION_DAYS: "-10",
      EXPORT_RETENTION_DAYS: "14",
      AUDIT_RETENTION_DAYS: "3650",
    });

    expect(config.assessmentRetentionDays).toBe(365 * 7);
    expect(config.patientRetentionDays).toBe(365 * 7);
    expect(config.exportRetentionDays).toBe(14);
    expect(config.auditRetentionDays).toBe(3650);
  });

  it("detects records that have reached their retention window", () => {
    expect(
      isRetentionEligible(new Date("2026-01-01T00:00:00.000Z"), 30, new Date("2026-01-31T00:00:00.000Z")),
    ).toBe(true);
    expect(
      isRetentionEligible(new Date("2026-01-01T00:00:00.000Z"), 30, new Date("2026-01-30T23:59:59.999Z")),
    ).toBe(false);
  });

  it("purges PHI-bearing records after their configured window", () => {
    const decision = getRetentionDecision(
      "assessmentRetentionDays",
      new Date("2026-01-01T00:00:00.000Z"),
      {
        now: new Date("2026-02-01T00:00:00.000Z"),
        config: {
          assessmentRetentionDays: 30,
          patientRetentionDays: 30,
          exportRetentionDays: 7,
          auditRetentionDays: 365,
        },
      },
    );

    expect(decision.action).toBe("purge");
    expect(decision.eligibleAt.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("anonymizes audit records instead of purging them by default", () => {
    const decision = getRetentionDecision(
      "auditRetentionDays",
      new Date("2026-01-01T00:00:00.000Z"),
      {
        now: new Date("2026-02-01T00:00:00.000Z"),
        config: {
          assessmentRetentionDays: 30,
          patientRetentionDays: 30,
          exportRetentionDays: 7,
          auditRetentionDays: 30,
        },
      },
    );

    expect(decision.action).toBe("anonymize");
  });

  it("retains otherwise eligible records when a hold is active", () => {
    const decision = getRetentionDecision(
      "patientRetentionDays",
      new Date("2026-01-01T00:00:00.000Z"),
      {
        now: new Date("2026-02-01T00:00:00.000Z"),
        hasLegalHold: true,
        config: {
          assessmentRetentionDays: 30,
          patientRetentionDays: 30,
          exportRetentionDays: 7,
          auditRetentionDays: 30,
        },
      },
    );

    expect(decision.action).toBe("retain");
    expect(decision.reason).toContain("hold");
  });
});

// ---------------------------------------------------------------------------
// Regression tests for getRetentionPolicyConfig fallback behavior.
//
// Locks down that every non-positive or non-numeric environment value triggers
// the documented default. These tests document the intended behavior in
// machine-readable form so future refactors of parsePositiveInt cannot
// accidentally weaken it.
// ---------------------------------------------------------------------------

describe("getRetentionPolicyConfig fallback regression", () => {
  it("falls back to defaults when ALL four retention fields are non-positive", () => {
    const config = getRetentionPolicyConfig({
      ASSESSMENT_RETENTION_DAYS: "-1",
      PATIENT_RETENTION_DAYS: "0",
      EXPORT_RETENTION_DAYS: "-100",
      AUDIT_RETENTION_DAYS: "-3650",
    });

    expect(config.assessmentRetentionDays).toBe(365 * 7);
    expect(config.patientRetentionDays).toBe(365 * 7);
    expect(config.exportRetentionDays).toBe(30);
    expect(config.auditRetentionDays).toBe(365 * 10);
  });

  it("falls back to defaults when ALL four retention fields are non-numeric", () => {
    const config = getRetentionPolicyConfig({
      ASSESSMENT_RETENTION_DAYS: "abc",
      PATIENT_RETENTION_DAYS: "",
      EXPORT_RETENTION_DAYS: "NaN",
      AUDIT_RETENTION_DAYS: "not-a-number",
    });

    expect(config.assessmentRetentionDays).toBe(365 * 7);
    expect(config.patientRetentionDays).toBe(365 * 7);
    expect(config.exportRetentionDays).toBe(30);
    expect(config.auditRetentionDays).toBe(365 * 10);
  });

  it("preserves valid values while falling back on invalid ones (mixed env)", () => {
    const config = getRetentionPolicyConfig({
      ASSESSMENT_RETENTION_DAYS: "30",       // valid
      PATIENT_RETENTION_DAYS: "-1",          // invalid (negative)
      EXPORT_RETENTION_DAYS: "7",            // valid
      AUDIT_RETENTION_DAYS: "0",             // invalid (zero)
    });

    expect(config.assessmentRetentionDays).toBe(30);
    expect(config.patientRetentionDays).toBe(365 * 7); // fallback
    expect(config.exportRetentionDays).toBe(7);
    expect(config.auditRetentionDays).toBe(365 * 10);  // fallback
  });

  it("accepts the boundary value 1 as positive", () => {
    const config = getRetentionPolicyConfig({
      ASSESSMENT_RETENTION_DAYS: "1",
    });
    expect(config.assessmentRetentionDays).toBe(1);
  });

  it("treats the string '0' as non-positive and falls back", () => {
    const config = getRetentionPolicyConfig({
      EXPORT_RETENTION_DAYS: "0",
    });
    expect(config.exportRetentionDays).toBe(30); // fallback
  });

  it("documents parseInt truncation for floating-point strings (1.5 -> 1, 30.5 -> 30)", () => {
    // The implementation uses Number.parseInt, which truncates toward zero.
    // 1.5 -> 1 (positive, accepted); 30.5 -> 30 (positive, accepted).
    // This is the existing behavior and is documented here so a future
    // change to use Number() instead would require updating this test.
    const config = getRetentionPolicyConfig({
      EXPORT_RETENTION_DAYS: "1.5",
      ASSESSMENT_RETENTION_DAYS: "30.5",
    });
    expect(config.exportRetentionDays).toBe(1);
    expect(config.assessmentRetentionDays).toBe(30);
  });

  it("treats leading/trailing whitespace as part of the value (parseInt skips it)", () => {
    // parseInt("  10  ", 10) === 10. Whitespace is silently ignored.
    const config = getRetentionPolicyConfig({
      ASSESSMENT_RETENTION_DAYS: "  10  ",
    });
    expect(config.assessmentRetentionDays).toBe(10);
  });
});
