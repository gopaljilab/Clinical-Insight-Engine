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

// Mock the storage module
vi.mock("../server/storage", () => {
  const mockStorageInstance = {
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    recordLoginAudit: vi.fn().mockResolvedValue(undefined),
  };

  return {
    storage: mockStorageInstance,
    DatabaseStorage: vi.fn().mockImplementation(() => mockStorageInstance),
  };
});

// Mock bcrypt compareSync because we want login to succeed
vi.mock("bcrypt", () => ({
  default: {
    compareSync: () => true,
    hashSync: () => "hashed",
  },
  compareSync: () => true,
  hashSync: () => "hashed",
}));

// Mock email service
vi.mock("../server/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

describe("OTP Brute-Force Lockout Integration", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the transaction mock to default (no select results)
    mockTxRef.tx = makeTx();

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
