import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireJwtAuth } from "./jwtVerification";

const mockRes = {
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
} as unknown as Response;
const mockNext = vi.fn();

const mockVerifyToken = vi.fn();
const mockGetAuthenticatedUser = vi.fn();
const mockLogSecurityEvent = vi.fn();

vi.mock("../services/auth/tokenValidator", () => ({
  verifyToken: (...args: any[]) => mockVerifyToken(...args),
}));

vi.mock("../auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../auth")>();
  return {
    ...actual,
    getAuthenticatedUser: (...args: any[]) => mockGetAuthenticatedUser(...args),
  };
});

vi.mock("../security/sqlProtection", () => ({
  logSecurityEvent: (...args: any[]) => mockLogSecurityEvent(...args),
}));

vi.mock("../logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

function makeReq(headers: Record<string, string | undefined> = {}): Request {
  return {
    headers,
  } as unknown as Request;
}

describe("requireJwtAuth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractBearerToken edge cases", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const req = makeReq({});
      await requireJwtAuth(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Unauthorized" });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it("returns 401 when Authorization header is not Bearer scheme", async () => {
      const req = makeReq({ authorization: "Basic dXNlcjpwYXNz" });
      await requireJwtAuth(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Unauthorized" });
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it("returns 401 when token has no dot (not a JWT)", async () => {
      const req = makeReq({ authorization: "Bearer notajwt" });
      await requireJwtAuth(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Unauthorized" });
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });

    it("passes token to verifyToken when Authorization header is valid Bearer", async () => {
      mockVerifyToken.mockReturnValue({
        valid: false,
        reason: "signature_invalid",
      });
      const req = makeReq({ authorization: "Bearer header.payload.sign" });
      await requireJwtAuth(req, mockRes, mockNext);

      expect(mockVerifyToken).toHaveBeenCalledWith("header.payload.sign");
    });
  });

  describe("requireJwtAuth verifyToken results", () => {
    it("returns 401 when token is invalid", async () => {
      mockVerifyToken.mockReturnValue({
        valid: false,
        reason: "signature_invalid",
      });
      const req = makeReq({ authorization: "Bearer invalid.token.here" });
      await requireJwtAuth(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Unauthorized" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("returns 403 when token role is not provider", async () => {
      mockVerifyToken.mockReturnValue({
        valid: true,
        payload: { sub: "user-123", email: "test@example.com", role: "ADMIN" },
      });
      const req = makeReq({ authorization: "Bearer valid.admin.token" });
      await requireJwtAuth(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ message: "Forbidden" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("returns 401 when getAuthenticatedUser returns null for valid provider JWT", async () => {
      mockVerifyToken.mockReturnValue({
        valid: true,
        payload: { sub: "user-123", email: "test@example.com", role: "provider" },
      });
      mockGetAuthenticatedUser.mockResolvedValue(null);
      const req = makeReq({ authorization: "Bearer valid.provider.token" });
      await requireJwtAuth(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Unauthorized" });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("attaches jwtUser and authenticatedUser and calls next for valid provider JWT", async () => {
      mockVerifyToken.mockReturnValue({
        valid: true,
        payload: { sub: "user-123", email: "test@example.com", role: "provider" },
      });
      mockGetAuthenticatedUser.mockResolvedValue({
        userId: "user-123",
        email: "test@example.com",
        role: "provider",
      });
      const req = makeReq({ authorization: "Bearer valid.provider.token" }) as any;

      await requireJwtAuth(req, mockRes, mockNext);

      expect(req.jwtUser).toEqual({
        sub: "user-123",
        email: "test@example.com",
        role: "provider",
      });
      expect(req.authenticatedUser).toEqual({
        userId: "user-123",
        email: "test@example.com",
        role: "provider",
      });
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("logs SQL_INJECTION_ATTEMPT when token has disallowed algorithm", async () => {
      mockVerifyToken.mockReturnValue({
        valid: false,
        reason: "alg_not_allowed",
      });
      const req = makeReq({ authorization: "Bearer algnone.payload.sig" });
      await requireJwtAuth(req, mockRes, mockNext);

      expect(mockLogSecurityEvent).toHaveBeenCalledWith(
        "SQL_INJECTION_ATTEMPT",
        expect.stringContaining("JWT verification failed"),
        req,
        { userId: undefined }
      );
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });
});
