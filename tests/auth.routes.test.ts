import { describe, it, expect, vi, beforeEach } from "vitest";
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

vi.mock("../server/db", () => {
  return {
    getDb: () => mockDb,
    getPool: vi.fn(),
    verifyDatabaseConnection: vi.fn(),
    closePool: vi.fn(),
  };
});

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

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    info: vi.fn().mockResolvedValue(""),
  })),
}));

describe("Auth Router - Resend OTP integration tests", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSendVerificationEmail.mockResolvedValue(true);

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
      .send({ mode: "login" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message", "Email is required.");
  });

  describe("login mode resend", () => {
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
        expect(mockSendVerificationCode).toHaveBeenCalledTimes(1);

        // Verify pending OTP is updated
        const updated = pendingOtps.get("valid@clinic.com");
        expect(updated).toBeDefined();
        expect(updated?.otp).toBeDefined();
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

    it("inserts new verification token on success", async () => {
      const mockLimit = vi.fn().mockResolvedValue([{ id: "user-id-2", email: "unverified@clinic.com", emailVerified: false }]);
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
          .send({ email: "unverified@clinic.com", mode: "register" });

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("success", true);
        expect(res.body).toHaveProperty("pendingEmail", "unverified@clinic.com");
        expect(mockSendVerificationCode).toHaveBeenCalledTimes(1);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
