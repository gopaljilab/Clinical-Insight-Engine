import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createAuthRouter, pendingOtps } from "../server/auth";

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

// Mock email services — auth.ts uses sendVerificationEmail
const { mockSendVerificationEmail } = vi.hoisted(() => ({
  mockSendVerificationEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock("../server/email", () => ({
  sendVerificationEmail: mockSendVerificationEmail,
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

    const { createAuthRouter } = await import("../server/auth");
    app = express();
    app.use(express.json());
    app.use(
      session({
        secret: "test-secret-resend-otp",
        resave: false,
        saveUninitialized: false,
      })
    );
    app.use("/api/auth", createAuthRouter());
  });

  it("POST /api/auth/resend-otp returns 400 when email is missing", async () => {
    const res = await request(app)
      .post("/api/auth/resend-otp")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message", "Email is required.");
  });

  describe("login mode resend", () => {
    it("resends OTP for existing user", async () => {
      mockSelectDbUser([{ id: "user-1", emailVerified: true }]);
      mockTransactionSuccess();

      const res = await request(app)
        .post("/api/auth/resend-otp")
        .send({ email: "user-1@clinic.com", mode: "login" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty(
        "message",
        "No pending verification found for this email. Please sign in again."
      );
    });

    it("returns 400 when no pending OTP exists for the email", async () => {
      const res = await request(app)
        .post("/api/auth/resend-otp")
        .send({ email: "newuser@clinic.com", mode: "login" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty(
        "message",
        "No pending verification found for this email. Please sign in again."
      );
    });

    it("returns 400 when pending OTP has expired", async () => {
      // Set expired OTP in pending Map
      pendingOtps.set("expired@clinic.com", {
        otp: "111111",
        expiresAt: Date.now() - 1000, // expired 1s ago
      });

      const res = await request(app)
        .post("/api/auth/resend-otp")
        .send({ email: "expired@clinic.com", mode: "login" });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message", "OTP has expired. Please sign in again.");
      expect(pendingOtps.has("expired@clinic.com")).toBe(false);
    });

    it("updates pending OTP and returns devOtp in dev environment on success", async () => {
      // Set valid pending OTP
      pendingOtps.set("valid@clinic.com", {
        otp: "111111",
        expiresAt: Date.now() + 60 * 1000,
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
        expect(res.body).not.toHaveProperty("devOtp");
        expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
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

    it("sends OTP for unverified user", async () => {
      mockSelectDbUser([{ id: "user-id-2", emailVerified: false }]);
      mockTransactionSuccess();

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      try {
        const res = await request(app)
          .post("/api/auth/resend-otp")
          .send({ email: "unverified@clinic.com", mode: "register" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("success", true);
        expect(res.body).toHaveProperty("pendingEmail", "unverified@clinic.com");
        expect(res.body).not.toHaveProperty("devOtp");
        expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
