import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createAuthRouter } from "../server/auth";

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

vi.mock("../server/db", () => {
  return {
    getDb: () => mockDb,
    getPool: vi.fn(),
    verifyDatabaseConnection: vi.fn(),
    closePool: vi.fn(),
  };
});

// Mock email services
const mockSendVerificationEmail = vi.fn().mockResolvedValue(true);
vi.mock("../server/email", () => ({
  sendVerificationEmail: (email: string, otp: string) => mockSendVerificationEmail(email, otp),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("../server/storage", () => ({
  storage: {
    recordLoginAudit: vi.fn().mockResolvedValue(undefined),
  },
}));

/** Helper: sets up mockDb.select to return the given user array */
function mockSelectDbUser(users: Array<{ id: string; emailVerified: boolean }>) {
  const mockLimit = vi.fn().mockResolvedValue(users);
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  mockDb.select.mockImplementation(() => ({ from: mockFrom }));
}

/** Helper: sets up mockDb.transaction to succeed (callback receives a mock tx) */
function mockTransactionSuccess() {
  mockDb.transaction.mockImplementation(async (callback: (tx: any) => any) => {
    const mockTx = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn().mockResolvedValue(undefined),
      })),
    };
    return callback(mockTx);
  });
}

describe("Auth Router - Resend OTP integration tests", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    it("updates pending OTP on success and does not leak OTP in response", async () => {
      // Mock db select to return user
      const mockLimit = vi.fn().mockResolvedValue([{ id: "user-id-1", email: "valid@clinic.com" }]);
      const mockWhere = vi.fn(() => ({ limit: mockLimit }));
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      mockDb.select.mockImplementation(() => ({ from: mockFrom }));

      // Mock transaction to verify old tokens are invalidated
      const mockUpdateSet = vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      }));
      const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = {
          update: mockUpdate,
          insert: mockInsert,
        };
        return callback(mockTx);
      });

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      try {
        const res = await request(app)
          .post("/api/auth/resend-otp")
          .send({ email: "valid@clinic.com", mode: "login" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("success", true);
        expect(res.body).toHaveProperty("pendingEmail", "valid@clinic.com");
        expect(res.body).not.toHaveProperty("devOtp"); // OTP must never leak in response
        expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);

        // Verify transaction invalidated old tokens and inserted new one
        expect(mockUpdate).toHaveBeenCalled();
        expect(mockInsert).toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe("register mode resend", () => {
    it("returns 404 when user is not found in database", async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn(() => ({ limit: mockLimit }));
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      mockDb.select.mockImplementation(() => ({ from: mockFrom }));

      const res = await request(app)
        .post("/api/auth/resend-otp")
        .send({ email: "nonexistent@clinic.com", mode: "register" });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message", "User not found.");
    });

    it("succeeds even when user is already verified", async () => {
      // The handler no longer blocks resend for verified users
      const mockLimit = vi.fn().mockResolvedValue([{ id: "user-id-1", emailVerified: true }]);
      const mockWhere = vi.fn(() => ({ limit: mockLimit }));
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      mockDb.select.mockImplementation(() => ({ from: mockFrom }));

      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn().mockResolvedValue(undefined),
            })),
          })),
          insert: vi.fn(() => ({
            values: vi.fn().mockResolvedValue(undefined),
          })),
        };
        return callback(mockTx);
      });

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";
      try {
        const res = await request(app)
          .post("/api/auth/resend-otp")
          .send({ email: "verified@clinic.com", mode: "register" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("success", true);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it("invalidates old tokens and inserts new verification token on success", async () => {
      // Mock db select to return unverified user
      const mockLimit = vi.fn().mockResolvedValue([{ id: "user-id-2", emailVerified: false }]);
      const mockWhere = vi.fn(() => ({ limit: mockLimit }));
      const mockFrom = vi.fn(() => ({ where: mockWhere }));
      mockDb.select.mockImplementation(() => ({ from: mockFrom }));

      // Mock transaction
      mockDb.transaction.mockImplementation(async (callback) => {
        const mockTx = {
          update: vi.fn(() => ({
            set: vi.fn(() => ({
              where: vi.fn().mockResolvedValue(undefined),
            })),
          })),
          insert: vi.fn(() => ({
            values: vi.fn().mockResolvedValue(undefined),
          })),
        };
        return callback(mockTx);
      });

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      try {
        const res = await request(app)
          .post("/api/auth/resend-otp")
          .send({ email: "unverified@clinic.com", mode: "register" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("success", true);
        expect(res.body).toHaveProperty("pendingEmail", "unverified@clinic.com");
        expect(res.body).not.toHaveProperty("devOtp"); // OTP must never leak in response
        expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
