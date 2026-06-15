import { describe, expect, it, vi } from "vitest";
import { getRlsDb, runWithRlsDb } from "../../server/db-rls";

const { mockDb } = vi.hoisted(() => ({
  mockDb: { _mock: true } as any,
}));

vi.mock("../../server/db", () => ({
  dbRlsStorage: new (require("async_hooks").AsyncLocalStorage)(),
  getPool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    }),
    query: vi.fn().mockResolvedValue({ rows: [] }),
    on: vi.fn(),
  })),
  getDb: vi.fn(() => mockDb),
}));

vi.mock("../../server/db-rls", async () => {
  const actual = await vi.importActual<typeof import("../../server/db-rls")>("../../server/db-rls");
  return actual;
});

describe("RLS Context Isolation", () => {
  it("getRlsDb() returns undefined when no RLS context is active", () => {
    const rlsDb = getRlsDb();
    expect(rlsDb).toBeUndefined();
  });

  it("getRlsDb() returns the RLS db when context is active", () => {
    const testDb = { _testRls: true } as any;
    runWithRlsDb(testDb, () => {
      const rlsDb = getRlsDb();
      expect(rlsDb).toBe(testDb);
    });
  });

  it("nested runWithRlsDb calls use the innermost db", () => {
    const outerDb = { name: "outer" } as any;
    const innerDb = { name: "inner" } as any;

    runWithRlsDb(outerDb, () => {
      expect(getRlsDb()).toBe(outerDb);
      runWithRlsDb(innerDb, () => {
        expect(getRlsDb()).toBe(innerDb);
      });
      expect(getRlsDb()).toBe(outerDb);
    });
  });

  it("AsyncLocalStorage context persists through async operations", async () => {
    const testDb = { _asyncTest: true } as any;

    await runWithRlsDb(testDb, async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
      const rlsDb = getRlsDb();
      expect(rlsDb).toBe(testDb);
    });
  });

  it("context is properly cleaned up after runWithRlsDb completes", () => {
    const testDb = { _cleanup: true } as any;
    runWithRlsDb(testDb, () => {
      expect(getRlsDb()).toBe(testDb);
    });
    expect(getRlsDb()).toBeUndefined();
  });
});

describe("createRlsClient", () => {
  it("sets PostgreSQL session variables for a provider", async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    const pool = {
      connect: vi.fn().mockResolvedValue({
        query: queryMock,
        release: vi.fn(),
      }),
      query: vi.fn(),
      on: vi.fn(),
    };

    const { getPool } = await import("../../server/db");
    vi.mocked(getPool).mockReturnValue(pool as any);
    const { createRlsClient } = await import("../../server/db-rls");

    const { client } = await createRlsClient({
      userId: "provider-uuid-123",
      email: "doctor@example.com",
      role: "DOCTOR",
    });

    expect(queryMock).toHaveBeenCalledWith(
      "SELECT set_config('app.current_user_id', $1, true)",
      ["provider-uuid-123"],
    );
    expect(queryMock).toHaveBeenCalledWith(
      "SELECT set_config('app.current_user_email', $1, true)",
      ["doctor@example.com"],
    );
    expect(queryMock).toHaveBeenCalledWith(
      "SELECT set_config('app.current_user_role', $1, true)",
      ["DOCTOR"],
    );
    expect(queryMock).toHaveBeenCalledTimes(3);
    client.release();
  });

  it("sets patient name when provided", async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [] });
    const pool = {
      connect: vi.fn().mockResolvedValue({
        query: queryMock,
        release: vi.fn(),
      }),
      query: vi.fn(),
      on: vi.fn(),
    };

    const { getPool } = await import("../../server/db");
    vi.mocked(getPool).mockReturnValue(pool as any);
    const { createRlsClient } = await import("../../server/db-rls");

    const { client } = await createRlsClient({
      userId: "patient-uuid-456",
      email: "patient@example.com",
      role: "PATIENT",
      patientName: "John Doe",
    });

    expect(queryMock).toHaveBeenCalledWith(
      "SELECT set_config('app.current_user_patient_name', $1, true)",
      ["John Doe"],
    );
    expect(queryMock).toHaveBeenCalledTimes(4);
    client.release();
  });
});
