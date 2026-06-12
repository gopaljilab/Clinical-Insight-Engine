import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createAuthRouter } from "../server/auth";

// Hold a mutable reference to the transaction mock so tests can swap it
const { mockTxRef, makeTx } = vi.hoisted(() => {
  function makeTx(selectReturns: any[] = []) {
    return {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue(selectReturns),
            })),
          })),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: 1 }]),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
    };
  }

  const ref: { tx: ReturnType<typeof makeTx> } = { tx: makeTx() };
  return { mockTxRef: ref, makeTx };
});

// Mock the db module
vi.mock("../server/db", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    getDb: () => ({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "test-user-id",
                fullName: "Test Doctor",
                email: "doc@example.com",
                medicalLicenseNumber: "DOC123",
                passwordHash: "$2b$10$UnqO1D.K2i8e.3yY4/pZkO/rQhZz7xI7TfX6f4r4uYgG0p0p0p0p.",
                role: "provider",
                isActive: true,
                emailVerified: true,
              }
            ]
          })
        })
      }),
      transaction: async (cb: any) => cb(mockTxRef.tx),
    })
  };
});

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("../server/db", () => ({
  getDb: () => mockDb,
}));

vi.mock("../server/storage", () => ({
  storage: {
    recordLoginAudit: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../server/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  validateEmailConfig: vi.fn(),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    info: vi.fn().mockResolvedValue(""),
  })),
}));

describe("OTP Brute-Force Lockout Integration", () => {
  let app: express.Express;
  let currentAttemptCount = 0;
  let tokenUsed = false;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the transaction mock to default (no select results)
    mockTxRef.tx = makeTx();

    currentAttemptCount = 0;
    tokenUsed = false;

    const { createAuthRouter } = await import("../server/auth");
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: "test-session-secret",
        resave: false,
        saveUninitialized: false,
      })
    );
    app.use("/api/auth", createAuthRouter());

    // Mock db user select
    const mockLimit = vi.fn().mockResolvedValue([
      {
        id: "test-user-id",
        fullName: "Test Doctor",
        email: "doc@example.com",
        medicalLicenseNumber: "DOC123",
        passwordHash: "$2b$10$BrtSaFVeZvqxGUJMxLtw8OdcjaZfI6gpeQpOxqUX9IW.nZA7Lh0Au",
        role: "provider",
        isActive: true,
        emailVerified: true,
      }
    ]);
    const mockWhere = vi.fn(() => ({ limit: mockLimit }));
    const mockFrom = vi.fn(() => ({ where: mockWhere }));
    mockDb.select.mockImplementation(() => ({ from: mockFrom }));

    // Mock db transaction for /login and /verify-email
    mockDb.transaction.mockImplementation(async (callback) => {
      const mockTx = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              orderBy: vi.fn().mockImplementation(() => ({
                limit: vi.fn().mockImplementation(async () => {
                  if (tokenUsed) return [];
                  return [
                    {
                      id: "token-id",
                      userId: "test-user-id",
                      verificationCode: "123456",
                      attemptCount: currentAttemptCount,
                      expiresAt: new Date(Date.now() + 100000),
                    },
                  ];
                }),
              })),
              limit: vi.fn().mockImplementation(async () => {
                if (tokenUsed) return [];
                return [
                  {
                    id: "token-id",
                    userId: "test-user-id",
                    verificationCode: "123456",
                    attemptCount: currentAttemptCount,
                    expiresAt: new Date(Date.now() + 100000),
                  },
                ];
              }),
            })),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn((setVal: any) => {
            if (setVal.attemptCount !== undefined) {
              currentAttemptCount = setVal.attemptCount;
            }
            if (setVal.used !== undefined) {
              tokenUsed = setVal.used;
            }
            return {
              where: vi.fn().mockResolvedValue(undefined),
            };
          }),
        })),
        insert: vi.fn(() => ({
          values: vi.fn().mockImplementation(async () => {
            tokenUsed = false;
            currentAttemptCount = 0;
            return undefined;
          }),
        })),
      };
      return callback(mockTx);
    });
  });

  it("locks out user after max failed OTP verification attempts", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "doc@example.com", password: "password" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.pendingEmail).toBe("doc@example.com");

    for (let i = 0; i < 5; i++) {
      mockTxRef.tx = makeTx([
        {
          id: 1,
          verificationCode: "123456",
          expiresAt: new Date(Date.now() + 600_000),
          used: false,
          attemptCount: i,
        },
      ]);
      const fail = await request(app)
        .post("/api/auth/verify-email")
        .send({ email: "doc@example.com", code: "000000" });
      expect(fail.status).toBe(401);
      const remaining = 5 - i - 1;
      if (remaining > 0) {
        expect(fail.body.message).toContain(`${remaining} attempt(s) remaining`);
      }
    }

    mockTxRef.tx = makeTx([
      {
        id: 1,
        verificationCode: "123456",
        expiresAt: new Date(Date.now() + 600_000),
        used: false,
        attemptCount: 5,
      },
    ]);
    const lockout = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "doc@example.com", code: "000000" });
    expect(lockout.status).toBe(429);
    expect(lockout.body.message).toContain("Too many failed attempts");
  });
});
