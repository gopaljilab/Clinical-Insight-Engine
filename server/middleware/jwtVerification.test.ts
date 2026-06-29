import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { requireJwtAuth } from "./jwtVerification";

let mockVerifyToken: ReturnType<typeof vi.fn>;
let mockLogSecurityEvent: ReturnType<typeof vi.fn>;
let mockGetAuthenticatedUser: ReturnType<typeof vi.fn>;

vi.mock("../services/auth/tokenValidator", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("../security/sqlProtection", () => ({
  logSecurityEvent: vi.fn(),
}));

vi.mock("../auth", () => ({
  getAuthenticatedUser: vi.fn(),
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
    headers: {},
    session: {},
    ...overrides,
  } as unknown as Request;
  return req;
}

describe("requireJwtAuth", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const tokenValidator = await import("../services/auth/tokenValidator");
    const sqlProtection = await import("../security/sqlProtection");
    const auth = await import("../auth");
    mockVerifyToken = vi.mocked(tokenValidator.verifyToken);
    mockLogSecurityEvent = vi.mocked(sqlProtection.logSecurityEvent);
    mockGetAuthenticatedUser = vi.mocked(auth.getAuthenticatedUser);
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = mockRequest({ headers: {} });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect((res as any)._status).toBe(401);
    expect((res as any)._body).toEqual({ message: "Unauthorized" });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "UNAUTHORIZED_SEARCH_ACCESS",
      expect.stringContaining("JWT required"),
      req
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is not Bearer", async () => {
    const req = mockRequest({ headers: { authorization: "Basic abc123" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect((res as any)._status).toBe(401);
    expect(mockLogSecurityEvent).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header has missing token", async () => {
    const req = mockRequest({ headers: { authorization: "Bearer" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect((res as any)._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token has no dots", async () => {
    const req = mockRequest({ headers: { authorization: "Bearer invalidtoken" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect((res as any)._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when verifyToken returns invalid", async () => {
    mockVerifyToken.mockReturnValue({ valid: false, reason: "signature_mismatch" });

    const req = mockRequest({ headers: { authorization: "Bearer some.invalid.token" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect((res as any)._status).toBe(401);
    expect((res as any)._body).toEqual({ message: "Unauthorized" });
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "UNAUTHORIZED_SEARCH_ACCESS",
      expect.stringContaining("JWT verification failed"),
      req,
      { userId: undefined }
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when verifyToken returns alg_not_allowed (SQL_INJECTION_ATTEMPT)", async () => {
    mockVerifyToken.mockReturnValue({ valid: false, reason: "alg_not_allowed" });

    const req = mockRequest({ headers: { authorization: "Bearer alg.none.token" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect((res as any)._status).toBe(401);
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "SQL_INJECTION_ATTEMPT",
      expect.any(String),
      req,
      { userId: undefined }
    );
  });

  it("returns 403 when role is not provider", async () => {
    mockVerifyToken.mockReturnValue({
      valid: true,
      payload: { sub: "user-1", email: "patient@example.com", role: "PATIENT" },
    });

    const req = mockRequest({ headers: { authorization: "Bearer valid.payload.signature" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect((res as any)._status).toBe(403);
    expect((res as any)._body).toEqual({ message: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when getAuthenticatedUser returns null", async () => {
    mockVerifyToken.mockReturnValue({
      valid: true,
      payload: { sub: "user-1", email: "test@example.com", role: "provider" },
    });
    mockGetAuthenticatedUser.mockResolvedValue(null);

    const req = mockRequest({ headers: { authorization: "Bearer valid.payload.signature" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect((res as any)._status).toBe(401);
    expect(mockLogSecurityEvent).toHaveBeenCalledWith(
      "UNAUTHORIZED_SEARCH_ACCESS",
      expect.stringContaining("disabled or not found"),
      req
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches jwtUser and authenticatedUser and calls next() on valid provider token", async () => {
    const mockAuthUser = { id: "user-1", email: "test@example.com", role: "provider" };
    mockVerifyToken.mockReturnValue({
      valid: true,
      payload: { sub: "user-1", email: "test@example.com", role: "provider" },
    });
    mockGetAuthenticatedUser.mockResolvedValue(mockAuthUser);

    const req = mockRequest({ headers: { authorization: "Bearer valid.payload.signature" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect((req as any).jwtUser).toEqual({ sub: "user-1", email: "test@example.com", role: "provider" });
    expect((req as any).authenticatedUser).toEqual(mockAuthUser);
    expect(next).toHaveBeenCalledWith();
  });
});
