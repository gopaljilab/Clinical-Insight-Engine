import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";

const mockUser = {
  id: "test-user-id",
  fullName: "Test Doctor",
  email: "doc@example.com",
  medicalLicenseNumber: "DOC123",
  passwordHash: "hashed",
  role: "provider",
  isActive: true,
  emailVerified: true,
};

let mockToken = {
  id: 1,
  userId: "test-user-id",
  verificationCode: "123456",
  expiresAt: new Date(Date.now() + 10000),
  used: false,
  attemptCount: 0,
};

const mockDb = {
  select: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => ({
        limit: vi.fn().mockResolvedValue([mockUser])
      }))
    }))
  })),
  transaction: vi.fn().mockImplementation(async (cb) => {
    const tx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            orderBy: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockResolvedValue([{ ...mockToken }])
            }))
          }))
        }))
      })),
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((data) => {
          if (data.attemptCount !== undefined) {
             mockToken.attemptCount = data.attemptCount;
          }
          return {
            where: vi.fn().mockResolvedValue(undefined)
          };
        })
      })),
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockResolvedValue(undefined)
      })),
    };
    return cb(tx);
  }),
};

vi.mock("../server/db", () => ({
  getDb: () => mockDb,
}));

vi.mock("../server/storage", () => ({
  storage: {
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
    recordLoginAudit: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("bcrypt", () => ({
  default: { compareSync: () => true, hashSync: () => "hashed" },
  compareSync: () => true,
  hashSync: () => "hashed",
}));

vi.mock("../server/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  validateEmailConfig: vi.fn(),
}));

describe("OTP Brute-Force Lockout Integration", () => {
  let app: express.Express;
  let currentAttemptCount = 0;
  let tokenUsed = false;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockToken.attemptCount = 0; // reset for each test
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

  it("locks out user after 5 failed OTP verification attempts", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "doc@example.com", password: "password" });

    expect(loginRes.status).toBe(200);

    const fail1 = await request(app).post("/api/auth/verify-email").send({ email: "doc@example.com", code: "000000" });
    expect(fail1.status).toBe(401);
    expect(fail1.body.message).toContain("2 attempt(s) remaining");

    const fail2 = await request(app).post("/api/auth/verify-email").send({ email: "doc@example.com", code: "000000" });
    expect(fail2.status).toBe(401);
    expect(fail2.body.message).toContain("1 attempt(s) remaining");

    const fail3 = await request(app).post("/api/auth/verify-email").send({ email: "doc@example.com", code: "000000" });
    expect(fail3.status).toBe(429);
    expect(fail3.body.message).toContain("Too many failed attempts");

    const fail4 = await request(app).post("/api/auth/verify-email").send({ email: "doc@example.com", code: "000000" });
    expect(fail4.status).toBe(400);
    expect(fail4.body.message).toContain("No valid verification code found");
  });
});
