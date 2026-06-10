import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createAuthRouter } from "../server/auth";

// Mock the db module to return our mock user on query
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
      })
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
  sendVerificationCode: vi.fn().mockResolvedValue(true),
  validateSmtpConfig: vi.fn(),
}));

describe("OTP Brute-Force Lockout Integration", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("locks out user after 3 failed OTP verification attempts", async () => {
    // 1. Post to login to trigger OTP creation
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "doc@example.com", password: "password" });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.pendingEmail).toBe("doc@example.com");
    
    // OTP is never leaked in the response — only sent via email / dev log

    // 2. First failed attempt: should return 401 with 2 attempts remaining
    const fail1 = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "doc@example.com", otp: "000000" });
    
    expect(fail1.status).toBe(401);
    expect(fail1.body.message).toContain("2 attempt(s) remaining");

    // 3. Second failed attempt: should return 401 with 1 attempt remaining
    const fail2 = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "doc@example.com", otp: "000000" });

    expect(fail2.status).toBe(401);
    expect(fail2.body.message).toContain("1 attempt(s) remaining");

    // 4. Third failed attempt: should trigger lockout and return 429
    const fail3 = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "doc@example.com", otp: "000000" });

    expect(fail3.status).toBe(429);
    expect(fail3.body.message).toContain("Too many failed attempts");

    // 5. Subsequent attempts: OTP should be deleted, returning 400
    const fail4 = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: "doc@example.com", otp: "000000" });

    expect(fail4.status).toBe(400);
    expect(fail4.body.message).toContain("No pending verification found");
  });
});
