import { describe, expect, it, vi } from "vitest";
import { runDataRetentionSweep } from "../services/data-retention-sweeper";
import { getDb } from "../db";

vi.mock("../db", () => {
  const mockDb = {
    select: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  };
  return {
    getDb: () => mockDb,
    getPool: () => ({}),
  };
});

// Mock getRetentionDecision & getRetentionPolicyConfig
vi.mock("../services/data-retention-policy", () => {
  return {
    getRetentionPolicyConfig: () => ({
      assessmentRetentionDays: 30,
      patientRetentionDays: 30,
      exportRetentionDays: 7,
      auditRetentionDays: 30,
    }),
    getRetentionDecision: (type: string, createdAt: Date, options: any) => {
      const cutoff = new Date(options.now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const isPast = createdAt.getTime() < cutoff.getTime();
      return {
        action: isPast ? (type === "auditRetentionDays" ? "anonymize" : "purge") : "retain",
        eligibleAt: new Date(),
        reason: "",
      };
    },
  };
});

describe("data retention sweeper", () => {
  it("purges and anonymizes eligible records", async () => {
    const db = getDb() as any;
    
    // Setup mock selects
    db.select.mockImplementation(() => ({
      from: vi.fn().mockResolvedValue([
        { id: 1, createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) }, // eligible
        { id: 2, createdAt: new Date() }, // not eligible
      ]),
    }));

    db.delete.mockImplementation(() => ({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    }));

    db.update.mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      }),
    }));

    const results = await runDataRetentionSweep(false);
    expect(results.purgedAssessments).toBe(1);
    expect(results.purgedPatients).toBe(1);
    expect(results.anonymizedAuditLogs).toBe(2); // 1 for login log, 1 for patient access log
  });

  it("performs dry run without modifying the database", async () => {
    const db = getDb() as any;
    vi.clearAllMocks();
    
    db.select.mockImplementation(() => ({
      from: vi.fn().mockResolvedValue([
        { id: 1, createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
      ]),
    }));

    const results = await runDataRetentionSweep(true);
    expect(results.purgedAssessments).toBe(1);
    expect(results.purgedPatients).toBe(1);
    expect(results.anonymizedAuditLogs).toBe(2);
    
    // Delete/update should not have been called during dry run
    expect(db.delete).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });
});
