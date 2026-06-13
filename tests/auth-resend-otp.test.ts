import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { eq } from "drizzle-orm";
import { users } from "../server/db/schema";

vi.mock("express-rate-limit", () => {
  const rateLimit = () => (req: any, res: any, next: any) => next();
  return { rateLimit, default: rateLimit };
});

const { mockSendVerificationEmail } = vi.hoisted(() => ({
  mockSendVerificationEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("../server/email", () => ({
  sendVerificationEmail: mockSendVerificationEmail,
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

const mockDb = {
  select: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("../server/db", () => ({
  getDb: vi.fn(() => mockDb),
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

/** Override getDb to return the given mock implementation */
async function setMockDb(mockImpl: any) {
  const mod = await import("../server/db");
  const getDbMock = mod.getDb as any;
  getDbMock.mockReturnValue(mockImpl);
}

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

  it("returns 404 when user is not found (no pending otp scenario)", async () => {
    await setMockDb({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      }),
      transaction: vi.fn(),
    });
    const app = await buildApp();
    return request(app)
      .post("/api/auth/resend-otp")
      .send({ email: "noone@clinic.com", mode: "login" })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toMatch(/No pending verification found/i);
      });
  });

  it("returns 404 when user is not found in database", async () => {
    // Mock db select to return empty array (user not found)
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn(() => ({ limit: mockLimit }));
    const mockFrom = vi.fn(() => ({ where: mockWhere }));
    mockDb.select.mockImplementation(() => ({ from: mockFrom }));

    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/resend-otp")
      .send({ email: "noone@clinic.com" });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/user not found/i);
  });

  it("resends OTP successfully when user exists (does not ask for password)", async () => {
    await setMockDb({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: "user-1", emailVerified: false }]),
          }),
        }),
      }),
      transaction: async (cb: any) => {
        const tx = {
          update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
          insert: () => ({ values: () => Promise.resolve() }),
        };
        return cb(tx);
      },
    });
    const app = await buildApp();
    const res = await request(app)
      .post("/api/auth/resend-otp")
      .send({ email: "test@clinic.com", mode: "register" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("pendingEmail");
    expect(Object.keys(res.body)).not.toContain("devOtp");
    expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1);
  });
});