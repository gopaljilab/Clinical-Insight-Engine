import { describe, expect, it, vi, beforeEach } from "vitest";
import { requireJwtAuth } from "./jwtVerification";
import type { Request, Response, NextFunction } from "express";

// --- Mock dependencies ---
const mockVerifyToken = vi.hoisted(() => vi.fn());
const mockLogSecurityEvent = vi.hoisted(() => vi.fn());
const mockGetAuthenticatedUser = vi.hoisted(() => vi.fn());

vi.mock("../services/auth/tokenValidator", () => ({
  verifyToken: mockVerifyToken,
}));

vi.mock("../security/sqlProtection", () => ({
  logSecurityEvent: mockLogSecurityEvent,
}));

// Mock getAuthenticatedUser (dynamically imported)
vi.mock("../auth", () => ({
  getAuthenticatedUser: mockGetAuthenticatedUser,
}));

// --- Helpers ---
function makeReq(overrides: any = {}) {
  return {
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(overrides: any = {}) {
  const res: any = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
    ...overrides,
  };
  return res;
}

function makeNext() {
  return vi.fn() as NextFunction;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1", email: "doc@hospital.org", role: "provider" });
});

describe("requireJwtAuth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = makeNext();

    await requireJwtAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "UNAUTHORIZED_SEARCH_ACCESS",
      expect.stringContaining("missing"),
      req
    );
  });

  it("returns 401 when Authorization header has wrong format (not Bearer)", async () => {
    const req = makeReq({ headers: { authorization: "Basic dXNlcjpwYXNz" } });
    const res = makeRes();
    const next = makeNext();

    await requireJwtAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  it("returns 401 when Authorization header has more than 2 parts", async () => {
    const req = makeReq({ headers: { authorization: "Bearer token extra" } });
    const res = makeRes();
    const next = makeNext();

    await requireJwtAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  it("returns 401 when Bearer token has no dot", async () => {
    const req = makeReq({ headers: { authorization: "Bearer not-a-jwt" } });
    const res = makeRes();
    const next = makeNext();

    await requireJwtAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  it("returns 401 when token verification fails (expired)", async () => {
    mockVerifyToken.mockReturnValueOnce({ valid: false, reason: "expired" });
    const req = makeReq({ headers: { authorization: "Bearer expired.token.here" } });
    const res = makeRes();
    const next = makeNext();

    await requireJwtAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "UNAUTHORIZED_SEARCH_ACCESS",
      expect.stringContaining("expired"),
      req,
      { userId: undefined }
    );
  });

  it("returns 401 and logs SQL_INJECTION_ATTEMPT when alg is not allowed", async () => {
    mockVerifyToken.mockReturnValueOnce({ valid: false, reason: "alg_not_allowed" });
    const req = makeReq({ headers: { authorization: "Bearer algnone.token.here" } });
    const res = makeRes();
    const next = makeNext();

    await requireJwtAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "SQL_INJECTION_ATTEMPT",
      expect.stringContaining("alg_not_allowed"),
      req,
      { userId: undefined }
    );
  });

  it("returns 403 when role is not provider", async () => {
    mockVerifyToken.mockReturnValueOnce({
      valid: true,
      payload: { sub: "user-99", email: "patient@hospital.org", role: "PATIENT" },
    });
    const req = makeReq({ headers: { authorization: "Bearer valid.patient.token" } });
    const res = makeRes();
    const next = makeNext();

    await requireJwtAuth(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ message: "Forbidden" });
  });

  it("returns 401 when getAuthenticatedUser returns null", async () => {
    mockVerifyToken.mockReturnValueOnce({
      valid: true,
      payload: { sub: "user-1", email: "doc@hospital.org", role: "provider" },
    });
    mockGetAuthenticatedUser.mockResolvedValueOnce(null);
    const req = makeReq({ headers: { authorization: "Bearer valid.provider.token" } });
    const res = makeRes();
    const next = makeNext();

    await requireJwtAuth(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "UNAUTHORIZED_SEARCH_ACCESS",
      expect.stringContaining("disabled"),
      req
    );
  });

  it("attaches jwtUser payload and calls next on valid provider JWT", async () => {
    const payload = { sub: "user-1", email: "doc@hospital.org", role: "provider" };
    mockVerifyToken.mockReturnValueOnce({ valid: true, payload });
    const req = makeReq({ headers: { authorization: "Bearer valid.provider.token" } }) as any;
    const res = makeRes();
    const next = makeNext();

    await requireJwtAuth(req, res, next);

    expect(req.jwtUser).toEqual(payload);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockLogSecurityEvent).not.toHaveBeenCalled();
  });

  it("attaches authenticatedUser from getAuthenticatedUser", async () => {
    const payload = { sub: "user-1", email: "doc@hospital.org", role: "provider" };
    const authUser = { id: "user-1", email: "doc@hospital.org", role: "provider" };
    mockVerifyToken.mockReturnValueOnce({ valid: true, payload });
    mockGetAuthenticatedUser.mockResolvedValueOnce(authUser);
    const req = makeReq({ headers: { authorization: "Bearer valid.provider.token" } }) as any;
    const res = makeRes();
    const next = makeNext();

    await requireJwtAuth(req, res, next);

    expect((req as any).authenticatedUser).toEqual(authUser);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
