import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { authenticateBatchOperation, logBatchCompletion } from "./batchAuthMiddleware";

vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("batchAuthMiddleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      session: {
        user: {
          id: "user-123",
          email: "user@example.com",
          emailVerified: true,
        },
        cookie: {
          expires: new Date(Date.now() + 3600000),
        },
      },
      ip: "127.0.0.1",
      get: vi.fn((header) => {
        if (header === "user-agent") return "TestAgent/1.0";
        if (header === "content-length") return "1000";
        return null;
      }),
    };

    mockRes = {
      status: vi.fn(function () {
        return this;
      }),
      json: vi.fn(function () {
        return this;
      }),
    };

    mockNext = vi.fn();
  });

  it("allows authenticated and verified users", async () => {
    await authenticateBatchOperation(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockNext).toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    mockReq.session = { user: undefined, cookie: {} };

    await authenticateBatchOperation(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("rejects unverified users", async () => {
    mockReq.session = {
      user: { id: "user-123", email: "user@example.com", emailVerified: false },
      cookie: { expires: new Date(Date.now() + 3600000) },
    };

    await authenticateBatchOperation(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("rejects expired sessions", async () => {
    mockReq.session = {
      user: { id: "user-123", email: "user@example.com", emailVerified: true },
      cookie: { expires: new Date(Date.now() - 1000) }, // Expired
    };

    await authenticateBatchOperation(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("rejects oversized payloads", async () => {
    mockReq.get = vi.fn((header) => {
      if (header === "content-length") return String(11 * 1024 * 1024); // 11MB
      return null;
    });

    await authenticateBatchOperation(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect(mockRes.status).toHaveBeenCalledWith(413);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("attaches validated user info for downstream handlers", async () => {
    await authenticateBatchOperation(
      mockReq as Request,
      mockRes as Response,
      mockNext
    );

    expect((mockReq as any).validatedUser).toEqual({
      id: "user-123",
      email: "user@example.com",
      emailVerified: true,
    });
  });

  it("logs batch operation completion", async () => {
    const { logger } = await import("../logger");

    logBatchCompletion("user-123", "batch_analysis", 100, 5, 1500);

    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        operationType: "batch_analysis",
        itemsProcessed: 100,
        itemsFailed: 5,
        duration: 1500,
      }),
      expect.any(String)
    );
  });
});
