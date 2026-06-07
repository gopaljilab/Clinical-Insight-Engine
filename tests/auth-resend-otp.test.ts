
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";

const { mockSendVerificationCode } = vi.hoisted(() => ({
  mockSendVerificationCode: vi.fn().mockResolvedValue(true),
}));

vi.mock("../server/email", () => ({
  sendVerificationCode: mockSendVerificationCode,
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("../server/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../server/storage", () => ({
  storage: {
    getUserByEmail: vi.fn(),
    createUser: vi.fn(),
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
    mockSendVerificationCode.mockResolvedValue(true);
  });

  it("returns 400 when email is missing", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/resend-otp")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email is required/i);
  });

  it("returns 400 when no pending OTP exists for login mode", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/resend-otp")
      .send({ email: "noone@clinic.com", mode: "login" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no pending verification/i);
  });

it("does not require password — only email", async () => {
    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/resend-otp")
      .send({ email: "test@clinic.com", mode: "login" });
    // The 400 should be for "no pending OTP", not for missing password
    expect(res.body.message).not.toMatch(/password/i);
  });
});