import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import patientRouter from "./patient.routes";

// ALL mock functions must be defined via vi.hoisted before vi.mock calls
const {
  mockGetPatientUserByEmail,
  mockGetPatientUserByPatientName,
  mockCreatePatientUser,
  mockGetPatientUserById,
  mockGetAssessmentsByPatientName,
  mockGetPatientTrends,
  mockIssueToken,
  mockVerifyToken,
  mockHashSync,
  mockCompareSync,
} = vi.hoisted(() => ({
  mockGetPatientUserByEmail: vi.fn(),
  mockGetPatientUserByPatientName: vi.fn(),
  mockCreatePatientUser: vi.fn(),
  mockGetPatientUserById: vi.fn(),
  mockGetAssessmentsByPatientName: vi.fn(),
  mockGetPatientTrends: vi.fn(),
  mockIssueToken: vi.fn(() => "mock-jwt-token"),
  mockVerifyToken: vi.fn(() => ({ valid: true, payload: { sub: "patient-1", email: "test@test.com", role: "PATIENT" } })),
  mockHashSync: vi.fn(() => "hashed_password"),
  mockCompareSync: vi.fn(() => true),
}));

vi.mock("express-rate-limit", () => {
  const rateLimit = () => (_req: any, _res: any, next: any) => next();
  return { rateLimit, default: rateLimit };
});

vi.mock("../storage", () => ({
  storage: {
    getPatientUserByEmail: mockGetPatientUserByEmail,
    getPatientUserByPatientName: mockGetPatientUserByPatientName,
    createPatientUser: mockCreatePatientUser,
    getPatientUserById: mockGetPatientUserById,
    getAssessmentsByPatientName: mockGetAssessmentsByPatientName,
    getPatientTrends: mockGetPatientTrends,
  },
}));

vi.mock("bcrypt", () => ({
  default: { hashSync: mockHashSync, compareSync: mockCompareSync },
  hashSync: mockHashSync,
  compareSync: mockCompareSync,
}));

vi.mock("../services/auth/tokenValidator", () => ({
  issueToken: mockIssueToken,
  verifyToken: mockVerifyToken,
}));

function makeApp(authHeader?: string) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    if (authHeader) {
      req.headers.authorization = authHeader;
    }
    next();
  });
  app.use("/patient-portal", patientRouter);
  return app;
}

describe("POST /patient-portal/auth/register", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 201 with token on valid registration", async () => {
    mockGetPatientUserByEmail.mockResolvedValue(null);
    mockGetPatientUserByPatientName.mockResolvedValue(null);
    mockCreatePatientUser.mockResolvedValue({
      id: "patient-1", patientName: "John Doe", email: "john@example.com", isActive: true, emailVerified: true,
    });

    const res = await request(makeApp())
      .post("/patient-portal/auth/register")
      .send({ patientName: "John Doe", email: "john@example.com", password: "secret123" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBe("mock-jwt-token");
  });

  it("returns 409 when email already exists", async () => {
    mockGetPatientUserByEmail.mockResolvedValue({ id: "existing", email: "john@example.com" });

    const res = await request(makeApp())
      .post("/patient-portal/auth/register")
      .send({ patientName: "John Doe", email: "john@example.com", password: "secret123" });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/email/i);
  });

  it("returns 400 for invalid email", async () => {
    const res = await request(makeApp())
      .post("/patient-portal/auth/register")
      .send({ patientName: "John", email: "not-an-email", password: "secret123" });

    expect(res.status).toBe(400);
  });

  it("returns 400 for short password", async () => {
    const res = await request(makeApp())
      .post("/patient-portal/auth/register")
      .send({ patientName: "John", email: "john@example.com", password: "12345" });

    expect(res.status).toBe(400);
  });
});

describe("POST /patient-portal/auth/login", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 200 with token on valid credentials", async () => {
    mockGetPatientUserByEmail.mockResolvedValue({
      id: "patient-1", patientName: "Jane Doe", email: "jane@example.com", passwordHash: "hashed", isActive: true,
    });

    const res = await request(makeApp())
      .post("/patient-portal/auth/login")
      .send({ email: "jane@example.com", password: "correctpassword" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("returns 401 on invalid credentials", async () => {
    mockGetPatientUserByEmail.mockResolvedValue(null);

    const res = await request(makeApp())
      .post("/patient-portal/auth/login")
      .send({ email: "nobody@example.com", password: "wrongpassword" });

    expect(res.status).toBe(401);
  });

  it("returns 403 for deactivated account", async () => {
    mockGetPatientUserByEmail.mockResolvedValue({ id: "patient-1", isActive: false });

    const res = await request(makeApp())
      .post("/patient-portal/auth/login")
      .send({ email: "deactivated@example.com", password: "password" });

    expect(res.status).toBe(403);
  });
});

describe("GET /patient-portal/auth/me", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 200 with user info for authenticated patient", async () => {
    mockGetPatientUserById.mockResolvedValue({ id: "patient-1", patientName: "John Doe", email: "john@example.com" });

    const res = await request(makeApp("Bearer patient-token"))
      .get("/patient-portal/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
  });

  it("returns 404 when user not found", async () => {
    mockGetPatientUserById.mockResolvedValue(null);

    const res = await request(makeApp("Bearer patient-token"))
      .get("/patient-portal/auth/me");

    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(makeApp())
      .get("/patient-portal/auth/me");

    expect(res.status).toBe(401);
  });
});

describe("GET /patient-portal/assessments", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 200 with assessments for authenticated patient", async () => {
    mockGetPatientUserById.mockResolvedValue({ id: "patient-1", patientName: "John" });
    mockGetAssessmentsByPatientName.mockResolvedValue([{ id: 1, riskScore: 25 }]);

    const res = await request(makeApp("Bearer patient-token"))
      .get("/patient-portal/assessments");

    expect(res.status).toBe(200);
  });

  it("returns 404 when patient not found", async () => {
    mockGetPatientUserById.mockResolvedValue(null);

    const res = await request(makeApp("Bearer patient-token"))
      .get("/patient-portal/assessments");

    expect(res.status).toBe(404);
  });
});

describe("GET /patient-portal/trends", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns 200 with patient trends", async () => {
    mockGetPatientUserById.mockResolvedValue({ id: "patient-1", patientName: "John" });
    mockGetPatientTrends.mockResolvedValue({ hba1cTrend: "stable" });

    const res = await request(makeApp("Bearer patient-token"))
      .get("/patient-portal/trends");

    expect(res.status).toBe(200);
  });

  it("returns 404 when patient not found", async () => {
    mockGetPatientUserById.mockResolvedValue(null);

    const res = await request(makeApp("Bearer patient-token"))
      .get("/patient-portal/trends");

    expect(res.status).toBe(404);
  });
});
