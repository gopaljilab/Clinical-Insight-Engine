import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Hoisted mocks (must be created before vi.mock calls) ───────────────────

const { mockStorage, mockPendingOtps, mockIssueToken, mockSendVerificationEmail, mockBcryptCompare } = vi.hoisted(() => {
  const map = new Map<string, { otp: string; expiresAt: number; attempts: number }>();
  return {
    mockStorage: {
      getPatientUserByEmail: vi.fn(),
      getPatientUserByPatientName: vi.fn(),
      createPatientUser: vi.fn(),
      getPatientUserById: vi.fn(),
      updatePatientEmailVerified: vi.fn(),
      getAssessmentsByPatientName: vi.fn(),
      getPatientTrends: vi.fn(),
    },
    mockPendingOtps: map,
    mockIssueToken: vi.fn(() => "mock-jwt-token"),
    mockSendVerificationEmail: vi.fn(async () => true),
    mockBcryptCompare: vi.fn(() => true),
  };
});

vi.mock("../storage", () => ({
  storage: mockStorage,
}));

vi.mock("../auth", () => ({
  pendingOtps: mockPendingOtps,
}));

vi.mock("../email", () => ({
  sendVerificationEmail: mockSendVerificationEmail,
}));

vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("bcrypt", () => ({
  default: {
    hashSync: vi.fn(() => "$2b$10$mockedhashstring1234567890123456789012345678901"),
    compareSync: mockBcryptCompare,
  },
}));

vi.mock("../services/auth/tokenValidator", () => ({
  issueToken: mockIssueToken,
}));

// ── Subject under test ─────────────────────────────────────────────────────

import {
  registerPatient,
  loginPatient,
  verifyPatientOTP,
  getMe,
} from "./patient.controller";

// ── Helpers ────────────────────────────────────────────────────────────────

function mockRequest(overrides: Record<string, any> = {}) {
  return {
    body: {},
    jwtUser: { sub: "user-1", email: "test@example.com", role: "PATIENT" },
    ...overrides,
  } as any;
}

function mockResponse() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.cookie = vi.fn(() => res);
  return res;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("registerPatient", () => {
  const validBody = {
    patientName: "TestPatient",
    email: "patient@example.com",
    password: "securePass123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPendingOtps.clear();
  });

  it("creates a patient with emailVerified: false and returns requiresOTP", async () => {
    mockStorage.getPatientUserByEmail.mockResolvedValue(undefined);
    mockStorage.getPatientUserByPatientName.mockResolvedValue(undefined);
    mockStorage.createPatientUser.mockResolvedValue({
      id: "patient-1",
      patientName: "TestPatient",
      email: "patient@example.com",
      emailVerified: false,
    });

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await registerPatient(req, res);

    // Verify user was created with emailVerified: false
    expect(mockStorage.createPatientUser).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerified: false }),
    );

    // Verify OTP was stored
    expect(mockPendingOtps.size).toBe(1);
    const pending = mockPendingOtps.get("patient@example.com");
    expect(pending).toBeDefined();
    expect(pending!.otp).toMatch(/^\d{6}$/);
    expect(pending!.expiresAt).toBeGreaterThan(Date.now());
    expect(pending!.attempts).toBe(0);

    // Verify verification email was sent
    expect(mockSendVerificationEmail).toHaveBeenCalledWith("patient@example.com", pending!.otp);

    // Verify response
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      requiresOTP: true,
      pendingEmail: "patient@example.com",
      message: "OTP sent to email. Verify to complete registration.",
    });

    // Verify NO JWT was issued yet
    expect(mockIssueToken).not.toHaveBeenCalled();
  });

  it("returns 409 if email already exists", async () => {
    mockStorage.getPatientUserByEmail.mockResolvedValue({ id: "existing", email: "patient@example.com" });

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await registerPatient(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "An account with this email already exists." });
    expect(mockStorage.createPatientUser).not.toHaveBeenCalled();
  });

  it("returns 409 if patient name already exists", async () => {
    mockStorage.getPatientUserByEmail.mockResolvedValue(undefined);
    mockStorage.getPatientUserByPatientName.mockResolvedValue({ id: "existing", patientName: "TestPatient" });

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await registerPatient(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "This patient name is already registered." });
    expect(mockStorage.createPatientUser).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid input", async () => {
    const req = mockRequest({ body: { patientName: "", email: "not-an-email", password: "12" } });
    const res = mockResponse();

    await registerPatient(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("handles email send failure gracefully — still returns 201", async () => {
    mockStorage.getPatientUserByEmail.mockResolvedValue(undefined);
    mockStorage.getPatientUserByPatientName.mockResolvedValue(undefined);
    mockStorage.createPatientUser.mockResolvedValue({
      id: "patient-1",
      patientName: "TestPatient",
      email: "patient@example.com",
    });
    mockSendVerificationEmail.mockResolvedValueOnce(false);

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await registerPatient(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, requiresOTP: true }),
    );
  });
});

describe("loginPatient", () => {
  const validBody = { email: "patient@example.com", password: "securePass123" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPendingOtps.clear();
  });

  it("logs in verified patient successfully", async () => {
    mockStorage.getPatientUserByEmail.mockResolvedValue({
      id: "patient-1",
      patientName: "TestPatient",
      email: "patient@example.com",
      passwordHash: "$2b$10$hashed",
      isActive: true,
      emailVerified: true,
    });

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await loginPatient(req, res);

    expect(mockIssueToken).toHaveBeenCalledWith("patient-1", "patient@example.com", "PATIENT", "24h");
    expect(res.cookie).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: { id: "patient-1", patientName: "TestPatient", email: "patient@example.com" },
    });
  });

  it("blocks login for unverified patient and sends OTP", async () => {
    mockStorage.getPatientUserByEmail.mockResolvedValue({
      id: "patient-1",
      patientName: "TestPatient",
      email: "patient@example.com",
      passwordHash: "$2b$10$hashed",
      isActive: true,
      emailVerified: false,
    });

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await loginPatient(req, res);

    expect(mockIssueToken).not.toHaveBeenCalled();

    expect(mockPendingOtps.size).toBe(1);
    const pending = mockPendingOtps.get("patient@example.com");
    expect(pending).toBeDefined();
    expect(pending!.otp).toMatch(/^\d{6}$/);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Email not verified. A verification code has been sent to your email.",
      requiresOTP: true,
      pendingEmail: "patient@example.com",
    });
  });

  it("returns 401 for invalid credentials", async () => {
    mockStorage.getPatientUserByEmail.mockResolvedValue(undefined);

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await loginPatient(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 for deactivated account", async () => {
    mockStorage.getPatientUserByEmail.mockResolvedValue({
      id: "patient-1",
      passwordHash: "$2b$10$hash",
      isActive: false,
      emailVerified: true,
    });

    const req = mockRequest({ body: validBody });
    const res = mockResponse();

    await loginPatient(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Account is deactivated." });
  });
});

describe("verifyPatientOTP", () => {
  const email = "patient@example.com";
  const otp = "123456";

  beforeEach(() => {
    vi.clearAllMocks();
    mockPendingOtps.clear();
  });

  it("verifies OTP and issues JWT", async () => {
    mockPendingOtps.set(email, { otp, expiresAt: Date.now() + 600000, attempts: 0 });
    mockStorage.getPatientUserByEmail.mockResolvedValue({
      id: "patient-1",
      patientName: "TestPatient",
      email,
      emailVerified: false,
    });
    mockStorage.updatePatientEmailVerified.mockResolvedValue({
      id: "patient-1",
      emailVerified: true,
    });

    const req = mockRequest({ body: { email, otp } });
    const res = mockResponse();

    await verifyPatientOTP(req, res);

    expect(mockPendingOtps.has(email)).toBe(false);
    expect(mockStorage.updatePatientEmailVerified).toHaveBeenCalledWith("patient-1", true);
    expect(mockIssueToken).toHaveBeenCalledWith("patient-1", email, "PATIENT", "24h");
    expect(res.cookie).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      user: { id: "patient-1", patientName: "TestPatient", email },
    });
  });

  it("rejects invalid OTP", async () => {
    mockPendingOtps.set(email, { otp, expiresAt: Date.now() + 600000, attempts: 0 });

    const req = mockRequest({ body: { email, otp: "999999" } });
    const res = mockResponse();

    await verifyPatientOTP(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockIssueToken).not.toHaveBeenCalled();
    expect(mockPendingOtps.get(email)!.attempts).toBe(1);
  });

  it("locks out after 3 failed attempts", async () => {
    mockPendingOtps.set(email, { otp, expiresAt: Date.now() + 600000, attempts: 2 });

    const req = mockRequest({ body: { email, otp: "000000" } });
    const res = mockResponse();

    await verifyPatientOTP(req, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(mockPendingOtps.has(email)).toBe(false);
    expect(mockIssueToken).not.toHaveBeenCalled();
  });

  it("rejects expired OTP", async () => {
    mockPendingOtps.set(email, { otp, expiresAt: Date.now() - 1000, attempts: 0 });

    const req = mockRequest({ body: { email, otp } });
    const res = mockResponse();

    await verifyPatientOTP(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "OTP has expired. Please register or sign in again.",
    });
    expect(mockPendingOtps.has(email)).toBe(false);
    expect(mockIssueToken).not.toHaveBeenCalled();
  });

  it("rejects OTP when no pending verification exists", async () => {
    const req = mockRequest({ body: { email, otp } });
    const res = mockResponse();

    await verifyPatientOTP(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "No pending verification found for this email. Please register or sign in again.",
    });
  });

  it("returns 400 for invalid input", async () => {
    const req = mockRequest({ body: { email: "not-email", otp: "12" } });
    const res = mockResponse();

    await verifyPatientOTP(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("getMe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns patient user by JWT sub", async () => {
    mockStorage.getPatientUserById.mockResolvedValue({
      id: "patient-1",
      patientName: "TestPatient",
      email: "patient@example.com",
    });

    const req = mockRequest();
    const res = mockResponse();

    await getMe(req, res);

    expect(mockStorage.getPatientUserById).toHaveBeenCalledWith("user-1");
    expect(res.json).toHaveBeenCalledWith({
      user: { id: "patient-1", patientName: "TestPatient", email: "patient@example.com" },
    });
  });

  it("returns 404 if user not found", async () => {
    mockStorage.getPatientUserById.mockResolvedValue(undefined);

    const req = mockRequest();
    const res = mockResponse();

    await getMe(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
