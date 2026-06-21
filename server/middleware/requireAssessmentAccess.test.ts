import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAssessmentAccess } from "./requireAssessmentAccess";

// All mock functions must be hoisted so vi.mock factories can reference them
const mockGetAssessmentById = vi.hoisted(() => vi.fn());
const mockCanAccessPatientRecord = vi.hoisted(() => vi.fn());
const mockLogAccessAttempt = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock("../storage", () => ({
  storage: { getAssessmentById: mockGetAssessmentById },
}));

vi.mock("../services/authz/patient-access", () => ({
  canAccessPatientRecord: mockCanAccessPatientRecord,
}));

vi.mock("../security/access-audit", () => ({
  logAccessAttempt: mockLogAccessAttempt,
}));

vi.mock("../logger", () => ({
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn() },
}));

function mockReq(overrides = {}) {
  return {
    params: { id: "123" },
    session: { user: { id: "user-1" } },
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {
    _status: null,
    _body: null,
    status(code: number) {
      this._status = code;
      return this;
    },
    json(body: any) {
      this._body = body;
      return this;
    },
  };
  return res;
}

const mockNext = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAssessmentAccess", () => {
  it("returns 400 for non-numeric ID", async () => {
    const req = mockReq({ params: { id: "abc" } });
    const res = mockRes();

    await requireAssessmentAccess(req, res, mockNext);

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ message: "Invalid assessment ID." });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 400 for negative ID", async () => {
    const req = mockReq({ params: { id: "-1" } });
    const res = mockRes();

    await requireAssessmentAccess(req, res, mockNext);

    expect(res._status).toBe(400);
    expect(res._body).toEqual({ message: "Invalid assessment ID." });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 401 when session user is missing", async () => {
    const req = mockReq({ params: { id: "123" }, session: {}, jwtUser: undefined });
    const res = mockRes();

    await requireAssessmentAccess(req, res, mockNext);

    expect(res._status).toBe(401);
    expect(res._body).toEqual({ message: "Unauthorized" });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 404 when assessment not found", async () => {
    mockGetAssessmentById.mockResolvedValue(null);
    const req = mockReq();
    const res = mockRes();

    await requireAssessmentAccess(req, res, mockNext);

    expect(res._status).toBe(404);
    expect(res._body).toEqual({ message: "Assessment not found." });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("returns 404 and logs IDOR attempt when user not authorized", async () => {
    const assessment = { id: 123, patientName: "Jane Doe" };
    mockGetAssessmentById.mockResolvedValue(assessment);
    mockCanAccessPatientRecord.mockReturnValue(false);
    const req = mockReq();
    const res = mockRes();

    await requireAssessmentAccess(req, res, mockNext);

    expect(res._status).toBe(404);
    expect(res._body).toEqual({ message: "Assessment not found." });
    expect(mockLogAccessAttempt).toHaveBeenCalledWith(
      "user-1",
      "Assessment",
      123,
      false,
      expect.stringContaining("IDOR")
    );
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("calls next and attaches assessment when authorized", async () => {
    const assessment = { id: 123, patientName: "Jane Doe" };
    mockGetAssessmentById.mockResolvedValue(assessment);
    mockCanAccessPatientRecord.mockReturnValue(true);
    const req = mockReq();
    const res = mockRes();

    await requireAssessmentAccess(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.assessment).toEqual(assessment);
    expect(mockLogAccessAttempt).toHaveBeenCalledWith(
      "user-1",
      "Assessment",
      123,
      true,
      expect.stringContaining("Authorized")
    );
  });

  it("returns 500 when storage throws", async () => {
    mockGetAssessmentById.mockRejectedValue(new Error("DB failure"));
    const req = mockReq();
    const res = mockRes();

    await requireAssessmentAccess(req, res, mockNext);

    expect(res._status).toBe(500);
    expect(res._body).toEqual({ message: "Internal server error" });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
