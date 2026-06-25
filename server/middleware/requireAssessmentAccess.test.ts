import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { requireAssessmentAccess } from "./requireAssessmentAccess";
import { storage } from "../storage";
import { canAccessPatientRecord } from "../services/authz/patient-access";
import { logAccessAttempt } from "../security/access-audit";

// --- Mock dependencies ---

vi.mock("../storage", () => ({
  storage: {
    getAssessmentById: vi.fn(),
  },
}));

vi.mock("../services/authz/patient-access", () => ({
  canAccessPatientRecord: vi.fn(),
}));

vi.mock("../security/access-audit", () => ({
  logAccessAttempt: vi.fn(),
}));

vi.mock("pino", () => {
  const mockPino = vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
  (mockPino as any).stdTimeFunctions = { isoTime: () => "iso-time" };
  return { default: mockPino };
});

// --- Helpers ---

function mockResponse() {
  const res = {
    _status: 200,
    _body: null as any,
  } as unknown as Response;
  (res as any).status = function(code: number) { (res as any)._status = code; return this; };
  (res as any).json = function(body: any) { (res as any)._body = body; return this; };
  return res;
}

function mockRequest(overrides: any = {}) {
  return {
    params: { id: "1" },
    session: {},
    ...overrides,
  } as unknown as Request;
}

const defaultUser = { id: 1, role: "patient" };
const defaultAssessment = { id: 1, patientId: 1 };

describe("requireAssessmentAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when assessment ID is NaN", async () => {
    const req = mockRequest({ params: { id: "abc" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(400);
    expect((res as any)._body).toEqual({ message: "Invalid assessment ID." });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 when assessment ID is zero", async () => {
    const req = mockRequest({ params: { id: "0" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(400);
    expect((res as any)._body).toEqual({ message: "Invalid assessment ID." });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 when assessment ID is negative", async () => {
    const req = mockRequest({ params: { id: "-5" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(400);
    expect((res as any)._body).toEqual({ message: "Invalid assessment ID." });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when neither session.user nor jwtUser is present", async () => {
    const req = mockRequest({ session: {}, jwtUser: undefined });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(401);
    expect((res as any)._body).toEqual({ message: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 when assessment is not found", async () => {
    const req = mockRequest({ session: { user: defaultUser } });
    const res = mockResponse();
    const next = vi.fn();

    vi.mocked(storage.getAssessmentById).mockResolvedValueOnce(null);

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(404);
    expect((res as any)._body).toEqual({ message: "Assessment not found." });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 (not 403) when user does not have access — IDOR protection", async () => {
    const req = mockRequest({ session: { user: { id: 2, role: "patient" } } });
    const res = mockResponse();
    const next = vi.fn();

    vi.mocked(storage.getAssessmentById).mockResolvedValueOnce(defaultAssessment);
    vi.mocked(canAccessPatientRecord).mockReturnValueOnce(false);
    vi.mocked(logAccessAttempt).mockReturnValueOnce(undefined);

    await requireAssessmentAccess(req, res, next);

    expect(vi.mocked(logAccessAttempt)).toHaveBeenCalledWith(
      2,
      "Assessment",
      1,
      false,
      "IDOR attempt: User not authorized to access this patient record"
    );
    expect((res as any)._status).toBe(404);
    expect((res as any)._body).toEqual({ message: "Assessment not found." });
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches assessment to request and calls next on authorized access", async () => {
    const req = mockRequest({ session: { user: defaultUser } }) as any;
    const res = mockResponse();
    const next = vi.fn();

    vi.mocked(storage.getAssessmentById).mockResolvedValueOnce(defaultAssessment);
    vi.mocked(canAccessPatientRecord).mockReturnValueOnce(true);
    vi.mocked(logAccessAttempt).mockReturnValueOnce(undefined);

    await requireAssessmentAccess(req, res, next);

    expect(vi.mocked(logAccessAttempt)).toHaveBeenCalledWith(
      1, "Assessment", 1, true, "Authorized access"
    );
    expect((req as any).assessment).toEqual(defaultAssessment);
    expect(next).toHaveBeenCalled();
  });

  it("returns 500 when storage throws an unexpected error", async () => {
    const req = mockRequest({ session: { user: defaultUser } });
    const res = mockResponse();
    const next = vi.fn();

    vi.mocked(storage.getAssessmentById).mockRejectedValueOnce(
      new Error("database connection lost")
    );

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(500);
    expect((res as any)._body).toEqual({ message: "Internal server error" });
    expect(next).not.toHaveBeenCalled();
  });
});
