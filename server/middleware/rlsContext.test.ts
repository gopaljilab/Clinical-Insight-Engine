import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { rlsContextMiddleware } from "./rlsContext";

vi.mock("../db-rls", () => ({
  createRlsClient: vi.fn().mockResolvedValue({
    client: {
      release: vi.fn(),
    },
    db: {},
  }),
  runWithRlsDb: vi.fn((_db, next) => next()),
}));

vi.mock("../db", () => ({
  getDb: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ patientName: "Test Patient" }]),
        }),
      }),
    }),
  }),
}));

vi.mock("@shared/schema", () => ({
  patientUsers: {},
}));

vi.mock("../services/auth/tokenValidator", () => ({
  verifyToken: vi.fn().mockReturnValue({ valid: false, payload: null }),
}));

import { createRlsClient, runWithRlsDb } from "../db-rls";
import { verifyToken } from "../services/auth/tokenValidator";

describe("rlsContextMiddleware", () => {
  let mockReq: Partial<Request>;
  let finishListeners: Array<() => void>;
  let closeListeners: Array<() => void>;
  let mockRes: Partial<Response>;
  let nextFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    finishListeners = [];
    closeListeners = [];
    nextFn = vi.fn();

    mockReq = {
      session: undefined,
      jwtUser: undefined,
      headers: {},
      authenticatedUser: undefined,
    };

    mockRes = {
      on: vi.fn((event: string, listener: () => void) => {
        if (event === "finish") finishListeners.push(listener);
        if (event === "close") closeListeners.push(listener);
        return mockRes as Response;
      }),
      onAll: vi.fn(),
      removeListener: vi.fn(),
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useFakeTimers();
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it("resolves context from session user", async () => {
    mockReq.session = {
      user: { id: "user-1", email: "doc@hospital.org", role: "provider" },
    } as any;

    await rlsContextMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect(createRlsClient).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", email: "doc@hospital.org" })
    );
    expect(runWithRlsDb).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
  });

  it("resolves context from jwtUser on request", async () => {
    mockReq.jwtUser = {
      sub: "jwt-user-2",
      email: "nurse@hospital.org",
      role: "provider",
    };

    await rlsContextMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect(createRlsClient).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "jwt-user-2" })
    );
    expect(runWithRlsDb).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
  });

  it("resolves context from Bearer token in Authorization header", async () => {
    mockReq.headers = { authorization: "Bearer valid.jwt.token" };
    (verifyToken as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      valid: true,
      payload: { sub: "token-user-3", email: "tech@hospital.org", role: "admin" },
    });

    await rlsContextMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect(verifyToken).toHaveBeenCalledWith("valid.jwt.token");
    expect(createRlsClient).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "token-user-3", email: "tech@hospital.org" })
    );
    expect(runWithRlsDb).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
  });

  it("does not call createRlsClient for unauthenticated request", async () => {
    // No session, no jwtUser, no Authorization header, no authenticatedUser
    await rlsContextMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect(createRlsClient).not.toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalledWith();
  });

  it("skips invalid Bearer token without throwing", async () => {
    mockReq.headers = { authorization: "Bearer invalid.token" };
    (verifyToken as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      valid: false,
      payload: null,
    });

    await rlsContextMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect(createRlsClient).not.toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
  });

  it("attaches cleanup handlers to res.on finish and close", async () => {
    mockReq.session = {
      user: { id: "user-1", email: "doc@hospital.org" },
    } as any;

    await rlsContextMiddleware(mockReq as Request, mockRes as Response, nextFn);

    expect(mockRes.on).toHaveBeenCalledWith("finish", expect.any(Function));
    expect(mockRes.on).toHaveBeenCalledWith("close", expect.any(Function));
  });
});
