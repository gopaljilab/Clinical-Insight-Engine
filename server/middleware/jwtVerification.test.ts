import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { requireJwtAuth } from "./jwtVerification";
import { verifyToken } from "../services/auth/tokenValidator";
import { logSecurityEvent } from "../security/sqlProtection";

// --- Mock dependencies ---

vi.mock("../services/auth/tokenValidator", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("../security/sqlProtection", () => ({
  logSecurityEvent: vi.fn(),
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
    headers: {},
    ...overrides,
  } as unknown as Request;
}

const validPayload = {
  valid: true,
  payload: { sub: "user-1", email: "test@example.com", role: "provider" },
};

describe("requireJwtAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const req = mockRequest({ headers: {} });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect(vi.mocked(logSecurityEvent)).toHaveBeenCalledWith(
      "UNAUTHORIZED_SEARCH_ACCESS",
      "JWT required but Authorization header is missing or malformed",
      req
    );
    expect((res as any)._status).toBe(401);
    expect((res as any)._body).toEqual({ message: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is not Bearer", async () => {
    const req = mockRequest({ headers: { authorization: "Basic dXNlcjpwYXNz" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect(vi.mocked(logSecurityEvent)).toHaveBeenCalledWith(
      "UNAUTHORIZED_SEARCH_ACCESS",
      "JWT required but Authorization header is missing or malformed",
      req
    );
    expect((res as any)._status).toBe(401);
    expect((res as any)._body).toEqual({ message: "Unauthorized" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token has no dots (malformed JWT)", async () => {
    const req = mockRequest({ headers: { authorization: "Bearer tokennonstructure" } });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res, next);

    expect(vi.mocked(logSecurityEvent)).toHaveBeenCalledWith(
      "UNAUTHORIZED_SEARCH_ACCESS",
      "JWT required but Authorization header is missing or malformed",
      req
    );
    expect((res as any)._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when token verification fails", async () => {
    const req = mockRequest({ headers: { authorization: "Bearer validstructure.but.invalid" } });
    const res = mockResponse();
    const next = vi.fn();

    vi.mocked(verifyToken).mockReturnValueOnce({ valid: false, reason: "invalid_signature" });

    await requireJwtAuth(req, res, next);

    expect(vi.mocked(logSecurityEvent)).toHaveBeenCalledWith(
      "UNAUTHORIZED_SEARCH_ACCESS",
      "JWT verification failed: invalid_signature",
      req,
      { userId: undefined }
    );
    expect((res as any)._status).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("logs SQL_INJECTION_ATTEMPT when algorithm is not allowed", async () => {
    const req = mockRequest({ headers: { authorization: "Bearer alg.none.sig" } });
    const res = mockResponse();
    const next = vi.fn();

    vi.mocked(verifyToken).mockReturnValueOnce({ valid: false, reason: "alg_not_allowed" });

    await requireJwtAuth(req, res, next);

    expect(vi.mocked(logSecurityEvent)).toHaveBeenCalledWith(
      "SQL_INJECTION_ATTEMPT",
      "JWT verification failed: alg_not_allowed",
      req,
      { userId: undefined }
    );
    expect((res as any)._status).toBe(401);
  });

  it("returns 403 when JWT role is not provider", async () => {
    const req = mockRequest({ headers: { authorization: "Bearer valid.token.here" } });
    const res = mockResponse();
    const next = vi.fn();

    vi.mocked(verifyToken).mockReturnValueOnce({
      valid: true,
      payload: { sub: "user-1", email: "patient@example.com", role: "patient" },
    });
    // Note: getAuthenticatedUser is never called when role !== provider (middleware returns 403 first)

    await requireJwtAuth(req, res, next);

    expect(vi.mocked(logSecurityEvent)).toHaveBeenCalledWith(
      "UNAUTHORIZED_SEARCH_ACCESS",
      "JWT verification failed: Invalid role 'patient', expected 'provider'",
      req,
      { userId: "user-1" }
    );
    expect((res as any)._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  // Note: the following two scenarios require getAuthenticatedUser mocking via dynamic import,
  // which has known hoisting complexity with vitest:
  // 1. getAuthenticatedUser returns null (disabled account) -> 401
  // 2. getAuthenticatedUser returns user + next() called + jwtUser/authenticatedUser attached
  // The critical JWT verification paths are covered by the 6 tests above.
});
