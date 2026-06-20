import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import patientPortalRouter from "../routes/patient.routes";

// Mock rate limiting to prevent test blocks
vi.mock("express-rate-limit", () => {
  const rateLimit = () => (req: any, res: any, next: any) => next();
  return { rateLimit, default: rateLimit };
});

// Mock fs to return a custom common passwords list
vi.mock("fs", () => ({
  default: {
    existsSync: () => true,
    readFileSync: () => "strongpassword123!\npassword",
  },
  existsSync: () => true,
  readFileSync: () => "strongpassword123!\npassword",
}));

// Mock storage
const { mockStorageInstance, mockUsers } = vi.hoisted(() => {
  const mockUsers = new Map<string, any>();
  const mockStorageInstance = {
    getPatientUserByEmail: vi.fn(async (email) => {
      return Array.from(mockUsers.values()).find((u) => u.email === email);
    }),
    getPatientUserByPatientName: vi.fn(async (name) => {
      return Array.from(mockUsers.values()).find((u) => u.patientName === name);
    }),
    createPatientUser: vi.fn(async (data) => {
      const id = (mockUsers.size + 1).toString();
      const newUser = { id, ...data };
      mockUsers.set(id, newUser);
      return newUser;
    }),
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

describe("Patient Registration - Password Complexity and Blocklist Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsers.clear();
  });

  it("returns 400 when password is under 8 characters", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/register")
      .send({
        patientName: "John Doe",
        email: "john.doe@example.com",
        password: "Pass1!",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("must be at least 8 characters");
  });

  it("returns 400 when password lacks uppercase letter", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/register")
      .send({
        patientName: "John Doe",
        email: "john.doe@example.com",
        password: "password123!",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("uppercase letter");
  });

  it("returns 400 when password lacks lowercase letter", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/register")
      .send({
        patientName: "John Doe",
        email: "john.doe@example.com",
        password: "PASSWORD123!",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("lowercase letter");
  });

  it("returns 400 when password lacks a number", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/register")
      .send({
        patientName: "John Doe",
        email: "john.doe@example.com",
        password: "Password!",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("number");
  });

  it("returns 400 when password lacks a special character", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/register")
      .send({
        patientName: "John Doe",
        email: "john.doe@example.com",
        password: "Password123",
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("special character");
  });

  it("returns 400 when password is in the common passwords blocklist", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/register")
      .send({
        patientName: "John Doe",
        email: "john.doe@example.com",
        password: "StrongPassWord123!", // In our mocked fs list
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Password is too common");
  });

  it("successfully registers user with a strong and unique password", async () => {
    const app = buildApp();
    const res = await request(app)
      .post("/api/patient/auth/register")
      .send({
        patientName: "John Doe",
        email: "john.doe@example.com",
        password: "AnotherStrongP@ss1!", // Not in our mocked list
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("token");
  });
});
