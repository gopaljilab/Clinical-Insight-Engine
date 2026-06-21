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
