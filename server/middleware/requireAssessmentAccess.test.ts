import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { requireAssessmentAccess } from "./requireAssessmentAccess";

// Store mock functions in module scope so beforeEach can reset them
let mockGetAssessmentById: ReturnType<typeof vi.fn>;
let mockLogAccessAttempt: ReturnType<typeof vi.fn>;
let mockCanAccessPatientRecord: ReturnType<typeof vi.fn>;

vi.mock("../storage", () => ({
  storage: {
    getAssessmentById: vi.fn(),
  },
}));

vi.mock("../security/access-audit", () => ({
  logAccessAttempt: vi.fn(),
}));

vi.mock("../services/authz/patient-access", () => ({
  canAccessPatientRecord: vi.fn(),
}));

vi.mock("pino", () => {
  const mockPino = vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  }));
  (mockPino as any).stdTimeFunctions = { isoTime: () => "iso-time" };
  return { default: mockPino };
});

function mockResponse() {
  const res = {} as unknown as Response;
  (res as any)._status = 200;
  (res as any)._body = null;
  (res as any).status = function(code: number) { (res as any)._status = code; return this; };
  (res as any).json = function(body: any) { (res as any)._body = body; return this; };
  return res;
}

function mockRequest(overrides: Record<string, any> = {}): Request {
  const req = {
    params: {},
    session: {},
    jwtUser: undefined,
    authenticatedUser: undefined,
    ...overrides,
  } as unknown as Request;
  return req;
}

describe("requireAssessmentAccess", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import to get fresh references to mocked functions
    const storage = await import("../storage");
    const accessAudit = await import("../security/access-audit");
    const patientAccess = await import("../services/authz/patient-access");
    mockGetAssessmentById = vi.mocked(storage.storage.getAssessmentById);
    mockLogAccessAttempt = vi.mocked(accessAudit.logAccessAttempt);
    mockCanAccessPatientRecord = vi.mocked(patientAccess.canAccessPatientRecord);
  });

  it("returns 400 when assessment ID is NaN", async () => {
    const req = mockRequest({ params: { id: "abc" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 when assessment ID is zero", async () => {
    const req = mockRequest({ params: { id: "0" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 when assessment ID is negative", async () => {
    const req = mockRequest({ params: { id: "-5" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when no authenticated user", async () => {
    const req = mockRequest({ params: { id: "1" }, session: {}, jwtUser: undefined });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 when assessment does not exist", async () => {
    mockGetAssessmentById.mockResolvedValue(undefined);

    const req = mockRequest({
      params: { id: "1" },
      session: { user: { id: "user-1", email: "test@example.com", role: "provider" } },
    });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 (IDOR masking) when user is not authorized to access assessment", async () => {
    mockGetAssessmentById.mockResolvedValue({ id: 1, createdBy: "other@example.com", userId: "other" });
    mockCanAccessPatientRecord.mockReturnValue(false);

    const req = mockRequest({
      params: { id: "1" },
      session: { user: { id: "user-1", email: "test@example.com", role: "provider" } },
    });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(404);
    expect(mockLogAccessAttempt).toHaveBeenCalledWith(
      "user-1",
      "Assessment",
      1,
      false,
      expect.stringContaining("IDOR")
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and attaches assessment on successful authorized access", async () => {
    const mockAssessment = { id: 42, createdBy: "test@example.com", userId: "user-1" };
    mockGetAssessmentById.mockResolvedValue(mockAssessment as any);
    mockCanAccessPatientRecord.mockReturnValue(true);

    const req = mockRequest({
      params: { id: "42" },
      session: { user: { id: "user-1", email: "test@example.com", role: "provider" } },
    });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((req as any).assessment).toEqual(mockAssessment);
    expect(mockLogAccessAttempt).toHaveBeenCalledWith(
      "user-1",
      "Assessment",
      42,
      true,
      "Authorized access"
    );
    expect(next).toHaveBeenCalledWith();
  });

  it("uses jwtUser when session user is absent", async () => {
    const mockAssessment = { id: 7, createdBy: "jwt@example.com", userId: "jwt-user" };
    mockGetAssessmentById.mockResolvedValue(mockAssessment as any);
    mockCanAccessPatientRecord.mockReturnValue(true);

    const req = mockRequest({
      params: { id: "7" },
      session: {},
      jwtUser: { id: "jwt-user", email: "jwt@example.com", role: "provider" },
    });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((req as any).assessment).toEqual(mockAssessment);
    expect(mockLogAccessAttempt).toHaveBeenCalledWith(
      "jwt-user",
      "Assessment",
      7,
      true,
      "Authorized access"
    );
    expect(next).toHaveBeenCalledWith();
  });

  it("returns 500 and logs error on unexpected exception", async () => {
    const err = new Error("database connection failed");
    mockGetAssessmentById.mockRejectedValue(err);

    const req = mockRequest({
      params: { id: "1" },
      session: { user: { id: "user-1", email: "test@example.com", role: "provider" } },
    });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });
});
