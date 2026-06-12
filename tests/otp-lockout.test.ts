import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";

// Mock rate limiting to prevent test blocks
vi.mock("express-rate-limit", () => {
  const rateLimit = () => (req: any, res: any, next: any) => next();
  return { rateLimit, default: rateLimit };
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
    // 1. Post to login to trigger OTP creation
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "doc@example.com", password: "password" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.pendingEmail).toBe("doc@example.com");

    // 2. Failed attempt 1
    const fail1 = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "doc@example.com", code: "000000" });
    expect(fail1.status).toBe(401);
    expect(fail1.body.message).toContain("4 attempt(s) remaining");

    // 3. Failed attempt 2
    const fail2 = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "doc@example.com", code: "000000" });
    expect(fail2.status).toBe(401);
    expect(fail2.body.message).toContain("3 attempt(s) remaining");

    // 4. Failed attempt 3
    const fail3 = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "doc@example.com", code: "000000" });
    expect(fail3.status).toBe(401);
    expect(fail3.body.message).toContain("2 attempt(s) remaining");

    // 5. Failed attempt 4
    const fail4 = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "doc@example.com", code: "000000" });
    expect(fail4.status).toBe(401);
    expect(fail4.body.message).toContain("1 attempt(s) remaining");

    // 6. Failed attempt 5: updates count to 5, message says "Please request a new code"
    const fail5 = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "doc@example.com", code: "000000" });
    expect(fail5.status).toBe(401);
    expect(fail5.body.message).toContain("Please request a new code");

    // 7. Attempt 6: count is 5, triggers lockout returning 429
    const fail6 = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "doc@example.com", code: "000000" });
    expect(fail6.status).toBe(429);
    expect(fail6.body.message).toContain("Too many failed attempts");

    // 8. Attempt 7: token is now marked as used, returns 400
    const fail7 = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "doc@example.com", code: "000000" });
    expect(fail7.status).toBe(400);
    expect(fail7.body.message).toContain("No valid verification code found");
  });
});
