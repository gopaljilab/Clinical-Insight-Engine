import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";

const { mockSendVerificationEmail } = vi.hoisted(() => ({
  mockSendVerificationEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("../server/email", () => ({
  sendVerificationEmail: mockSendVerificationEmail,
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

const mockSelect = vi.fn();
const mockTransaction = vi.fn();

const mockDb = {
  select: mockSelect,
  transaction: mockTransaction,
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

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    info: vi.fn().mockResolvedValue(""),
  })),
}));

async function buildApp() {
  const { createAuthRouter } = await import("../server/auth");
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use("/api/auth", createAuthRouter());
  return app;
}

describe("POST /api/auth/resend-otp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendVerificationEmail.mockResolvedValue(true);
  });

  it("returns 400 when email is missing", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/resend-otp")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email is required/i);
  });

  it("returns 404 when no user exists in database", async () => {
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn(() => ({ limit: mockLimit }));
    const mockFrom = vi.fn(() => ({ where: mockWhere }));
    mockSelect.mockImplementation(() => ({ from: mockFrom }));

    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/resend-otp")
      .send({ email: "noone@clinic.com" });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/user not found/i);
  });

  it("does not require password — only email", async () => {
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn(() => ({ limit: mockLimit }));
    const mockFrom = vi.fn(() => ({ where: mockWhere }));
    mockSelect.mockImplementation(() => ({ from: mockFrom }));

    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/resend-otp")
      .send({ email: "test@clinic.com" });
    // The 404 should be for "user not found", not for missing password
    expect(res.body.message).not.toMatch(/password/i);
  });
});