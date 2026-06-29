import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { rlsContextMiddleware } from "./rlsContext";

vi.mock("../db-rls", () => ({
  createRlsClient: vi.fn(),
  runWithRlsDb: vi.fn(),
}));

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../services/auth/tokenValidator", () => ({
  verifyToken: vi.fn(),
}));

vi.mock("../security/access-audit", () => ({
  logAccessAttempt: vi.fn(),
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
  const handlers: Record<string, Function[]> = {};
  (res as any)._status = 200;
  (res as any)._body = null;
  (res as any).status = function(code: number) { (res as any)._status = code; return this; };
  (res as any).json = function(body: any) { (res as any)._body = body; return this; };
  (res as any).on = function(event: string, cb: Function) {
    if (!handlers[event]) handlers[event] = [];
    handlers[event].push(cb);
    return this;
  };
  (res as any)._emit = function(event: string) {
    (handlers[event] || []).forEach(cb => cb());
  };
  return res;
}

function mockRequest(overrides: Record<string, any> = {}): Request {
  const req = {
    headers: {},
    session: {},
    jwtUser: undefined,
    ...overrides,
  } as unknown as Request;
  return req;
}

describe("rlsContextMiddleware", () => {
  let mockCreateRlsClient: ReturnType<typeof vi.fn>;
  let mockRunWithRlsDb: ReturnType<typeof vi.fn>;
  let mockVerifyToken: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dbRls = await import("../db-rls");
    const db = await import("../db");
    const tokenValidator = await import("../services/auth/tokenValidator");

    mockCreateRlsClient = vi.mocked(dbRls.createRlsClient);
    mockRunWithRlsDb = vi.mocked(dbRls.runWithRlsDb);
    mockVerifyToken = vi.mocked(tokenValidator.verifyToken);

    // Mock getDb for resolvePatientName (used in PATIENT role case)
    vi.mocked(db.getDb).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ patientName: "John Doe" }]),
    } as any);
  });

  it("calls next() immediately when no user context is available", async () => {
    const req = mockRequest({ session: {}, headers: {} });
    const res = mockResponse();
    const next = vi.fn();

    await rlsContextMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockCreateRlsClient).not.toHaveBeenCalled();
  });

  it("extracts context from session.user and calls runWithRlsDb", async () => {
    const mockRelease = vi.fn();
    mockCreateRlsClient.mockResolvedValue({ client: { release: mockRelease }, db: {} });
    mockRunWithRlsDb.mockImplementation((_db, next) => { next(); });

    const req = mockRequest({
      session: { user: { id: "user-1", email: "test@example.com", role: "provider" } },
    });
    const res = mockResponse();
    const next = vi.fn();

    await rlsContextMiddleware(req, res, next);

    expect(mockCreateRlsClient).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", email: "test@example.com", role: "provider" })
    );
    expect(mockRunWithRlsDb).toHaveBeenCalledWith(expect.any(Object), next);
  });

  it("extracts context from jwtUser and resolves patientName for PATIENT role", async () => {
    const mockRelease = vi.fn();
    mockCreateRlsClient.mockResolvedValue({ client: { release: mockRelease }, db: {} });
    mockRunWithRlsDb.mockImplementation((_db, next) => { next(); });

    const req = mockRequest({
      jwtUser: { sub: "patient-1", email: "patient@example.com", role: "PATIENT" },
    });
    const res = mockResponse();
    const next = vi.fn();

    await rlsContextMiddleware(req, res, next);

    expect(mockCreateRlsClient).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "patient-1",
        role: "PATIENT",
        patientName: "John Doe",
      })
    );
  });

  it("extracts context from Authorization Bearer header when session and jwtUser are absent", async () => {
    mockVerifyToken.mockReturnValue({
      valid: true,
      payload: { sub: "jwt-user", email: "jwt@example.com", role: "provider" },
    });

    const mockRelease = vi.fn();
    mockCreateRlsClient.mockResolvedValue({ client: { release: mockRelease }, db: {} });
    mockRunWithRlsDb.mockImplementation((_db, next) => { next(); });

    const req = mockRequest({
      session: {},
      jwtUser: undefined,
      headers: { authorization: "Bearer jwt.token.here" },
    });
    const res = mockResponse();
    const next = vi.fn();

    await rlsContextMiddleware(req, res, next);

    expect(mockVerifyToken).toHaveBeenCalledWith("jwt.token.here");
    expect(mockCreateRlsClient).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "jwt-user", email: "jwt@example.com", role: "provider" })
    );
  });

  it("extracts context from req.authenticatedUser when session and jwtUser are absent", async () => {
    const mockRelease = vi.fn();
    mockCreateRlsClient.mockResolvedValue({ client: { release: mockRelease }, db: {} });
    mockRunWithRlsDb.mockImplementation((_db, next) => { next(); });

    const req = mockRequest({
      session: {},
      jwtUser: undefined,
      headers: {},
      authenticatedUser: { id: "auth-user", email: "auth@example.com", role: "admin" },
    } as any);
    const res = mockResponse();
    const next = vi.fn();

    await rlsContextMiddleware(req, res, next);

    expect(mockCreateRlsClient).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "auth-user", email: "auth@example.com", role: "admin" })
    );
  });

  it("registers finish and close event listeners to release client", async () => {
    const mockRelease = vi.fn();
    mockCreateRlsClient.mockResolvedValue({ client: { release: mockRelease }, db: {} });
    mockRunWithRlsDb.mockImplementation((_db, next) => { next(); });

    const req = mockRequest({
      session: { user: { id: "user-1", email: "test@example.com", role: "provider" } },
    });
    const res = mockResponse();
    const next = vi.fn();

    await rlsContextMiddleware(req, res, next);

    expect(mockRelease).not.toHaveBeenCalled();

    (res as any)._emit("finish");
    expect(mockRelease).toHaveBeenCalledTimes(1);

    (res as any)._emit("finish");
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("releaseClient is a no-op after first call", async () => {
    const mockRelease = vi.fn();
    mockCreateRlsClient.mockResolvedValue({ client: { release: mockRelease }, db: {} });
    mockRunWithRlsDb.mockImplementation((_db, next) => { next(); });

    const req = mockRequest({
      session: { user: { id: "user-1", email: "test@example.com", role: "provider" } },
    });
    const res = mockResponse();
    const next = vi.fn();

    await rlsContextMiddleware(req, res, next);

    (res as any)._emit("finish");
    (res as any)._emit("close");

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("releases client and calls next with error when createRlsClient throws", async () => {
    mockCreateRlsClient.mockRejectedValue(new Error("RLS setup failed"));

    const req = mockRequest({
      session: { user: { id: "user-1", email: "test@example.com", role: "provider" } },
    });
    const res = mockResponse();
    const next = vi.fn();

    await rlsContextMiddleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it("does not release client twice when finish fires after close", async () => {
    const mockRelease = vi.fn();
    mockCreateRlsClient.mockResolvedValue({ client: { release: mockRelease }, db: {} });
    mockRunWithRlsDb.mockImplementation((_db, next) => { next(); });

    const req = mockRequest({
      session: { user: { id: "user-1", email: "test@example.com", role: "provider" } },
    });
    const res = mockResponse();
    const next = vi.fn();

    await rlsContextMiddleware(req, res, next);

    (res as any)._emit("close");
    expect(mockRelease).toHaveBeenCalledTimes(1);

    (res as any)._emit("finish");
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
