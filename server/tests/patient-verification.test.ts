import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import patientPortalRouter from "../routes/patient.routes";
import { issueToken } from "../services/auth/tokenValidator";

// Mock rate limiting to prevent test blocks
vi.mock("express-rate-limit", () => {
  const rateLimit = () => (req: any, res: any, next: any) => next();
  return { rateLimit, default: rateLimit };
});

// Mock email service
const { mockSendVerificationEmail } = vi.hoisted(() => ({
  mockSendVerificationEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock("../email", () => ({
  sendVerificationEmail: mockSendVerificationEmail,
}));

// Mock storage with in-memory store for isolation
const { mockStorageInstance, mockUsers } = vi.hoisted(() => {
  const mockUsers = new Map<string, any>();
  const mockStorageInstance = {
    getPatientUserByEmail: vi.fn(async (email) => {
      return Array.from(mockUsers.values()).find((u) => u.email === email);
    }),
    getPatientUserByPatientName: vi.fn(async (name) => {
      return Array.from(mockUsers.values()).find((u) => u.patientName === name);
    }),
    getPatientUserById: vi.fn(async (id) => {
      return mockUsers.get(id);
    }),
    createPatientUser: vi.fn(async (data) => {
      const id = (mockUsers.size + 1).toString();
      const newUser = { id, ...data };
      mockUsers.set(id, newUser);
      return newUser;
    }),
    updatePatientUser: vi.fn(async (id, data) => {
      const user = mockUsers.get(id);
      if (!user) throw new Error("User not found");
      const updated = { ...user, ...data };
      mockUsers.set(id, updated);
      return updated;
    }),
    getAssessmentsByPatientName: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    getPatientTrends: vi.fn().mockResolvedValue([]),
  };
  return { mockStorageInstance, mockUsers };
});

vi.mock("../storage", () => ({
  storage: mockStorageInstance,
  DatabaseStorage: vi.fn().mockImplementation(() => mockStorageInstance),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/patient", patientPortalRouter);
  return app;
}

describe("Patient Portal - Email Verification Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsers.clear();
  });

  it("POST /api/patient/auth/register generates a code, calls sendVerificationEmail, and leaves emailVerified as false", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/register")
      .send({
        patientName: "Jane Doe",
        email: "jane.doe@example.com",
        password: "Password123!",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body.message).toContain("Verification code sent to your email");
    expect(res.body.email).toBe("jane.doe@example.com");

    expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
    const mockUser = Array.from(mockUsers.values())[0];
    expect(mockUser.emailVerified).toBe(false);
    expect(mockUser.verificationCode).toHaveLength(6);
    expect(mockUser.verificationExpires.getTime()).toBeGreaterThan(Date.now());
  });

  it("POST /api/patient/auth/verify-email successfully verifies the email and returns a JWT", async () => {
    // Manually insert an unverified user
    const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);
    const user = await mockStorageInstance.createPatientUser({
      patientName: "Jane Doe",
      email: "jane.doe@example.com",
      passwordHash: "hash",
      isActive: true,
      emailVerified: false,
      verificationCode: "123456",
      verificationExpires,
      verificationAttempts: 0,
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/verify-email")
      .send({
        email: "jane.doe@example.com",
        code: "123456",
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe("jane.doe@example.com");

    const updatedUser = mockUsers.get(user.id);
    expect(updatedUser.emailVerified).toBe(true);
    expect(updatedUser.verificationCode).toBeNull();
    expect(updatedUser.verificationExpires).toBeNull();
  });

  it("POST /api/patient/auth/verify-email rejects wrong code and tracks attempts", async () => {
    const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);
    const user = await mockStorageInstance.createPatientUser({
      patientName: "Jane Doe",
      email: "jane.doe@example.com",
      passwordHash: "hash",
      isActive: true,
      emailVerified: false,
      verificationCode: "123456",
      verificationExpires,
      verificationAttempts: 0,
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/verify-email")
      .send({
        email: "jane.doe@example.com",
        code: "000000",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid verification code");

    const updatedUser = mockUsers.get(user.id);
    expect(updatedUser.emailVerified).toBe(false);
    expect(updatedUser.verificationAttempts).toBe(1);
  });

  it("POST /api/patient/auth/verify-email rejects expired code", async () => {
    const verificationExpires = new Date(Date.now() - 1000); // 1s ago
    await mockStorageInstance.createPatientUser({
      patientName: "Jane Doe",
      email: "jane.doe@example.com",
      passwordHash: "hash",
      isActive: true,
      emailVerified: false,
      verificationCode: "123456",
      verificationExpires,
      verificationAttempts: 0,
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/verify-email")
      .send({
        email: "jane.doe@example.com",
        code: "123456",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("expired");
  });

  it("POST /api/patient/auth/verify-email locks out after 5 attempts", async () => {
    const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);
    await mockStorageInstance.createPatientUser({
      patientName: "Jane Doe",
      email: "jane.doe@example.com",
      passwordHash: "hash",
      isActive: true,
      emailVerified: false,
      verificationCode: "123456",
      verificationExpires,
      verificationAttempts: 5, // Already tried 5 times
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/verify-email")
      .send({
        email: "jane.doe@example.com",
        code: "123456", // Even with correct code, too many attempts
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Too many failed attempts");
  });

  it("POST /api/patient/auth/resend-code generates a new code and resets attempts", async () => {
    const verificationExpires = new Date(Date.now() + 5 * 60 * 1000);
    const user = await mockStorageInstance.createPatientUser({
      patientName: "Jane Doe",
      email: "jane.doe@example.com",
      passwordHash: "hash",
      isActive: true,
      emailVerified: false,
      verificationCode: "123456",
      verificationExpires,
      verificationAttempts: 3,
    });

    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/resend-code")
      .send({ email: "jane.doe@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("sent");
    expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);

    const updatedUser = mockUsers.get(user.id);
    expect(updatedUser.verificationCode).not.toBe("123456");
    expect(updatedUser.verificationCode).toHaveLength(6);
    expect(updatedUser.verificationAttempts).toBe(0);
  });

  it("GET /api/patient/assessments blocks unverified users with a 403 status", async () => {
    await mockStorageInstance.createPatientUser({
      patientName: "Jane Doe",
      email: "jane.doe@example.com",
      passwordHash: "hash",
      isActive: true,
      emailVerified: false,
    });

    const token = issueToken("1", "jane.doe@example.com", "PATIENT", "24h");
    const app = buildApp();
    const res = await request(app)
      .get("/api/patient/assessments")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Email not verified");
  });

  it("GET /api/patient/assessments allows verified users", async () => {
    await mockStorageInstance.createPatientUser({
      patientName: "Jane Doe",
      email: "jane.doe@example.com",
      passwordHash: "hash",
      isActive: true,
      emailVerified: true,
    });

    const token = issueToken("1", "jane.doe@example.com", "PATIENT", "24h");
    const app = buildApp();
    const res = await request(app)
      .get("/api/patient/assessments")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});
