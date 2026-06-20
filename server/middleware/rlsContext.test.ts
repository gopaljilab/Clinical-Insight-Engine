import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { rlsContextMiddleware } from "./rlsContext";

const mockNext = vi.fn();
const mockRes = {
  on: vi.fn(),
} as unknown as Response;
const mockReqBase = {
  session: {},
  jwtUser: undefined,
  headers: {},
} as unknown as Request;

const mockCreateRlsClient = vi.fn();
const mockRunWithRlsDb = vi.fn();

vi.mock("../db-rls", () => ({
  createRlsClient: (...args: any[]) => mockCreateRlsClient(...args),
  runWithRlsDb: (...args: any[]) => mockRunWithRlsDb(...args),
}));

vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe("rlsContextMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNext.mockClear();
    mockRes.on.mockClear();
  });

  it("calls next without attaching RLS context when no session, no jwtUser, and no auth header", async () => {
    const req = {
      ...mockReqBase,
      session: {},
      jwtUser: undefined,
      headers: {},
      authenticatedUser: undefined,
    } as unknown as Request;

    await rlsContextMiddleware(req, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(mockCreateRlsClient).not.toHaveBeenCalled();
  });

  it("attaches RLS context from session.user when present", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    vi.doMock("../db", () => ({
      getDb: () => mockDb,
    }));

    const req = {
      ...mockReqBase,
      session: { user: { id: "user-123", email: "test@example.com", role: "provider" } },
      jwtUser: undefined,
      headers: {},
      authenticatedUser: undefined,
    } as unknown as Request;

    mockCreateRlsClient.mockResolvedValue({
      db: {},
      client: { release: vi.fn() },
    });
    mockRunWithRlsDb.mockImplementation((_db: any, next: NextFunction) => next());

    await rlsContextMiddleware(req, mockRes, mockNext);

    expect(mockCreateRlsClient).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        email: "test@example.com",
        role: "provider",
      })
    );
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("attaches RLS context from jwtUser on req when present", async () => {
    const req = {
      ...mockReqBase,
      session: {},
      jwtUser: { sub: "jwt-user-456", email: "jwt@example.com", role: "PATIENT" },
      headers: {},
      authenticatedUser: undefined,
    } as unknown as Request;

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    vi.doMock("../db", () => ({
      getDb: () => mockDb,
    }));

    mockCreateRlsClient.mockResolvedValue({
      db: {},
      client: { release: vi.fn() },
    });
    mockRunWithRlsDb.mockImplementation((_db: any, next: NextFunction) => next());

    await rlsContextMiddleware(req, mockRes, mockNext);

    expect(mockCreateRlsClient).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "jwt-user-456",
        email: "jwt@example.com",
        role: "PATIENT",
      })
    );
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("attaches RLS context from authenticatedUser when session and jwtUser are absent", async () => {
    const req = {
      ...mockReqBase,
      session: {},
      jwtUser: undefined,
      headers: {},
      authenticatedUser: { userId: "auth-user-789", email: "auth@example.com", role: "admin" },
    } as unknown as Request;

    mockCreateRlsClient.mockResolvedValue({
      db: {},
      client: { release: vi.fn() },
    });
    mockRunWithRlsDb.mockImplementation((_db: any, next: NextFunction) => next());

    await rlsContextMiddleware(req, mockRes, mockNext);

    expect(mockCreateRlsClient).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "auth-user-789",
        email: "auth@example.com",
        role: "admin",
      })
    );
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it("calls next and releases client on res.finish event", async () => {
    const releaseMock = vi.fn();
    mockRes.on.mockImplementation((event: string, handler: () => void) => {
      if (event === "finish") {
        // Store handler to call later
        (mockRes as any)._finishHandler = handler;
      }
    });

    const req = {
      ...mockReqBase,
      session: { user: { id: "user-123", email: "test@example.com", role: "provider" } },
      jwtUser: undefined,
      headers: {},
      authenticatedUser: undefined,
    } as unknown as Request;

    const client = { release: releaseMock };
    mockCreateRlsClient.mockResolvedValue({ db: {}, client });
    mockRunWithRlsDb.mockImplementation((_db: any, next: NextFunction) => next());

    await rlsContextMiddleware(req, mockRes, mockNext);

    expect(mockRes.on).toHaveBeenCalledWith("finish", expect.any(Function));

    // Simulate finish event
    const finishHandler = (mockRes as any)._finishHandler;
    finishHandler();

    expect(releaseMock).toHaveBeenCalledTimes(1);
  });

  it("calls next with error when createRlsClient throws", async () => {
    const req = {
      ...mockReqBase,
      session: { user: { id: "user-123", email: "test@example.com", role: "provider" } },
      jwtUser: undefined,
      headers: {},
      authenticatedUser: undefined,
    } as unknown as Request;

    const testError = new Error("RLS setup failed");
    mockCreateRlsClient.mockRejectedValue(testError);

    await rlsContextMiddleware(req, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(testError);
  });
});
