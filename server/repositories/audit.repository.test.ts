import { describe, it, expect, vi } from "vitest";
import { AuditRepository } from "./audit.repository";

// Mock the db to prevent DATABASE_URL error at instantiation time
vi.mock("../db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({ from: vi.fn() })),
    insert: vi.fn(),
    update: vi.fn(),
  })),
}));

describe("AuditRepository", () => {
  it("can be instantiated", () => {
    const repo = new AuditRepository();
    expect(repo).toBeDefined();
  });

  it("has getLoginAuditLogs method", () => {
    const repo = new AuditRepository();
    expect(typeof repo.getLoginAuditLogs).toBe("function");
  });

  it("has recordLoginAudit method", () => {
    const repo = new AuditRepository();
    expect(typeof repo.recordLoginAudit).toBe("function");
  });

  it("has recordPatientAccess method", () => {
    const repo = new AuditRepository();
    expect(typeof repo.recordPatientAccess).toBe("function");
  });

  it("has getPatientAccessAuditLogs method", () => {
    const repo = new AuditRepository();
    expect(typeof repo.getPatientAccessAuditLogs).toBe("function");
  });
});
