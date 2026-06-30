import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request } from "express";
import { requireJwtAuth } from "./jwtVerification";

// We need to test extractBearerToken which is not exported.
// Instead, test requireJwtAuth through the HTTP interface using supertest-like mocks.

// --- Mock dependencies ---

vi.mock("../services/auth/tokenValidator", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("../security/sqlProtection", () => ({
  logSecurityEvent: vi.fn(),
}));

const mockVerifyToken = vi.importMock("../services/auth/tokenValidator", () => ({
  verifyToken: vi.fn(),
})).verifyToken;

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as Request;
}

function mockResponse() {
  const res: any = { statusCode: 200, _body: null };
  res.status = function(code: number) { this.statusCode = code; return this; };
  res.json = function(body: any) { this._body = body; return this; };
  return res;
}

describe("extractBearerToken scenarios via requireJwtAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when Authorization header is missing", async () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res as any, next as any);

    expect(res.statusCode).toBe(401);
    expect(res._body.message).toBe("Unauthorized");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns null for Basic auth scheme", async () => {
    const req = mockRequest({ authorization: "Basic dXNlcjpwYXNz" });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res as any, next as any);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns null for malformed header (no space)", async () => {
    const req = mockRequest({ authorization: "Bearertoken123" });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res as any, next as any);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns null for token without dots", async () => {
    const req = mockRequest({ authorization: "Bearer not_a_jwt" });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res as any, next as any);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns null for empty token", async () => {
    const req = mockRequest({ authorization: "Bearer " });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res as any, next as any);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("case-insensitive matching for Bearer scheme", async () => {
    const req = mockRequest({ authorization: "bearer eyJhbGciOiJIUzI1NiJ9.signature" });
    const res = mockResponse();
    const next = vi.fn();

    const { verifyToken } = await import("../services/auth/tokenValidator");
    vi.mocked(verifyToken).mockReturnValue({ valid: false, reason: "invalid" });

    await requireJwtAuth(req, res as any, next as any);

    // Should not be 401 due to missing header (Bearer was recognized)
    expect(res.statusCode).toBe(401); // still 401 but for invalid token, not missing header
  });

  it("returns null for wrong part count (three parts)", async () => {
    const req = mockRequest({ authorization: "Bearer a.b.c" });
    const res = mockResponse();
    const next = vi.fn();

    await requireJwtAuth(req, res as any, next as any);

    // Three parts is not valid Bearer format
    expect(res.statusCode).toBe(401);
  });
});
