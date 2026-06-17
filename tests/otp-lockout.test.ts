import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";

const mockSelect = vi.fn();
const mockTransaction = vi.fn();

const mockDb = {
  select: mockSelect,
  transaction: mockTransaction,
};

vi.mock("../server/db", () => {
  return {
    getDb: () => mockDb,
    getPool: vi.fn(),
    verifyDatabaseConnection: vi.fn(),
    closePool: vi.fn(),
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
  validateEmailConfig: vi.fn(),
}));

describe("OTP Brute-Force Lockout Integration", () => {
  let app: express.Express;
  let attemptCount = 0;
  let isUsed = false;

  beforeEach(async () => {
    vi.clearAllMocks();
    attemptCount = 0;
    isUsed = false;

    // Mock DB select for user lookup
    const mockLimitUser = vi.fn().mockResolvedValue([{
      id: "test-user-id",
      fullName: "Test Doctor",
      email: "doc@example.com",
      medicalLicenseNumber: "DOC123",
      passwordHash: "hashed",
      role: "provider",
      isActive: true,
      emailVerified: true,
    }]);
    const mockWhereUser = vi.fn(() => ({ limit: mockLimitUser }));
    const mockFromUser = vi.fn(() => ({ where: mockWhereUser }));
    mockSelect.mockImplementation(() => ({ from: mockFromUser }));

    // Mock DB transaction and queries
    mockTransaction.mockImplementation(async (callback) => {
      const mockTx = {
        update: vi.fn(() => ({
          set: vi.fn((updateData: any) => {
            if (updateData.attemptCount !== undefined) {
              attemptCount = updateData.attemptCount;
            }
            if (updateData.used !== undefined) {
              isUsed = updateData.used;
            }
            return {
              where: vi.fn().mockResolvedValue([{}]),
            };
          }),
        })),
        insert: vi.fn(() => ({
          values: vi.fn().mockImplementation(() => {
            isUsed = false;
            attemptCount = 0;
            return {
              returning: vi.fn().mockResolvedValue([{ id: "new-user-id" }]),
            };
          }),
        })),
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn().mockImplementation(async () => {
                  return isUsed ? [] : [{
                    id: "token-id-1",
                    userId: "test-user-id",
                    verificationCode: "123456", // Correct verification code is 123456
                    expiresAt: new Date(Date.now() + 100000),
                    used: isUsed,
                    attemptCount,
                  }];
                }),
              })),
            })),
          })),
        })),
      };
      return callback(mockTx);
    });

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
  });

  it("locks out user after 5 failed OTP verification attempts", async () => {
    // 1. Post to login to trigger OTP creation
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "doc@example.com", password: "password" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.pendingEmail).toBe("doc@example.com");

    const sessionCookie = loginRes.headers["set-cookie"];

    // 2. Failed attempts 1 to 5: should return 401 with remaining attempts
    for (let i = 1; i <= 5; i++) {
      const failRes = await request(app)
        .post("/api/auth/verify-email")
        .set("Cookie", sessionCookie)
        .send({ email: "doc@example.com", code: "000000" });

      expect(failRes.status).toBe(401);
      const expectedRemaining = 5 - i;
      if (expectedRemaining > 0) {
        expect(failRes.body.message).toContain(`${expectedRemaining} attempt(s) remaining`);
      } else {
        expect(failRes.body.message).toContain("Please request a new code");
      }
    }

    // 3. 6th failed attempt: lockout and return 429
    const fail6 = await request(app)
      .post("/api/auth/verify-email")
      .set("Cookie", sessionCookie)
      .send({ email: "doc@example.com", code: "000000" });

    expect(fail6.status).toBe(429);
    expect(fail6.body.message).toContain("Too many failed attempts");

    // 4. Subsequent attempts: token is deactivated, returning 400
    const failSubsequent = await request(app)
      .post("/api/auth/verify-email")
      .set("Cookie", sessionCookie)
      .send({ email: "doc@example.com", code: "000000" });

    expect(failSubsequent.status).toBe(400);
    expect(failSubsequent.body.message).toContain("No valid verification code found");
  });
});
