import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const { mockLogAccessAttempt } = vi.hoisted(() => ({
  mockLogAccessAttempt: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getAssessmentById: vi.fn(),
  },
}));

vi.mock("../services/authz/patient-access", () => ({
  canAccessPatientRecord: vi.fn(),
}));

vi.mock("../security/access-audit", () => ({
  logAccessAttempt: mockLogAccessAttempt,
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { requireAssessmentAccess } = await import("./requireAssessmentAccess");
const { storage } = await import("../storage");
const { canAccessPatientRecord } = await import("../services/authz/patient-access");
const mockStorage = storage as any;
const mockCanAccess = canAccessPatientRecord as any;

function mockResponse() {
  const res = {
    _status: 200,
    _body: null as any,
  } as unknown as Response;
  (res as any).status = function (code: number) { (res as any)._status = code; return this; };
  (res as any).json = function (body: any) { (res as any)._body = body; return this; };
  return res;
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    ...overrides,
  } as unknown as Request;
}

describe("requireAssessmentAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when neither session nor jwtUser is present", async () => {
    const req = mockRequest({ params: { id: "1" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(401);
    expect((res as any)._body).toEqual({ message: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 for NaN assessment ID", async () => {
    const req = mockRequest({ params: { id: "abc" } }) as any;
    req.session = { user: { id: "user1" } };
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(400);
    expect((res as any)._body).toEqual({ message: "Invalid assessment ID." });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 for assessment ID <= 0", async () => {
    const req = mockRequest({ params: { id: "0" } }) as any;
    req.session = { user: { id: "user1" } };
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(400);
    expect((res as any)._body).toEqual({ message: "Invalid assessment ID." });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 when assessment is not found", async () => {
    mockStorage.getAssessmentById.mockResolvedValueOnce(null);
    const req = mockRequest({ params: { id: "42" } }) as any;
    req.session = { user: { id: "user1" } };
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(404);
    expect((res as any)._body).toEqual({ message: "Assessment not found." });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 and logs denied access when user lacks authorization (IDOR)", async () => {
    const assessment = { id: 5, patientName: "Secret Patient" };
    mockStorage.getAssessmentById.mockResolvedValueOnce(assessment);
    mockCanAccess.mockReturnValueOnce(false);
    const req = mockRequest({ params: { id: "5" } }) as any;
    req.session = { user: { id: "user2" } };
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(404);
    expect((res as any)._body).toEqual({ message: "Assessment not found." });
    expect(mockLogAccessAttempt).toHaveBeenCalledWith(
      "user2",
      "Assessment",
      5,
      false,
      expect.stringContaining("IDOR attempt")
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next and attaches assessment when user has access", async () => {
    const assessment = { id: 7, patientName: "My Patient" };
    mockStorage.getAssessmentById.mockResolvedValueOnce(assessment);
    mockCanAccess.mockReturnValueOnce(true);
    const req = mockRequest({ params: { id: "7" } }) as any;
    req.session = { user: { id: "user3" } };
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).assessment).toEqual(assessment);
    expect(mockLogAccessAttempt).toHaveBeenCalledWith(
      "user3",
      "Assessment",
      7,
      true,
      "Authorized access"
    );
  });

  it("returns 500 when storage throws an error", async () => {
    mockStorage.getAssessmentById.mockRejectedValueOnce(new Error("DB down"));
    const req = mockRequest({ params: { id: "1" } }) as any;
    req.session = { user: { id: "user1" } };
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect((res as any)._status).toBe(500);
    expect((res as any)._body).toEqual({ message: "Internal server error" });
    expect(next).not.toHaveBeenCalled();
  });

  it("uses jwtUser when session is not present", async () => {
    const assessment = { id: 9, patientName: "JWT Patient" };
    mockStorage.getAssessmentById.mockResolvedValueOnce(assessment);
    mockCanAccess.mockReturnValueOnce(true);
    const req = mockRequest({ params: { id: "9" } }) as any;
    req.jwtUser = { id: "jwt-user-1" };
    const res = mockResponse();
    const next = vi.fn();

    await requireAssessmentAccess(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).assessment).toEqual(assessment);
  });
});
