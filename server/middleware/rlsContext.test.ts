import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Stub modules before rlsContext.ts loads
vi.mock("../db-rls", () => ({
  createRlsClient: vi.fn().mockResolvedValue({ client: {}, db: {} }),
  runWithRlsDb: vi.fn((_db: unknown, next: () => void) => next()),
}));

vi.mock("../db", () => ({
  getDb: vi.fn().mockReturnValue({}),
}));

vi.mock("../../shared/schema", () => ({
  patientUsers: {},
}));

vi.mock("pino", () => {
  const mockFn = vi.fn();
  return {
    default: Object.assign(
      () => ({ info: mockFn, warn: mockFn, error: mockFn, child: () => ({ info: mockFn, warn: mockFn, error: mockFn }) }),
      { stdTimeFunctions: { isoTime: () => "iso-time" } }
    ),
  };
});

import { rlsContextMiddleware } from "./rlsContext";
import { createRlsClient, runWithRlsDb } from "../db-rls";

function mockResponse() {
  let finishListeners: Array<() => void> = [];
  let closeListeners: Array<() => void> = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const originalSetTimeout = globalThis.setTimeout;
  (globalThis as any).setTimeout = (fn: Function, delay: number) => {
    const id = originalSetTimeout(() => { fn(); }, delay);
    timers.push(id as any);
    return id;
  };

  const res = {
    on(event: string, fn: () => void) {
      if (event === "finish") finishListeners.push(fn);
      if (event === "close") closeListeners.push(fn);
      return res;
    },
    emit(event: string) {
      if (event === "finish") finishListeners.forEach(fn => fn());
      if (event === "close") closeListeners.forEach(fn => fn());
    },
    finishListeners,
    closeListeners,
  } as unknown as Response;

  return {
    res,
    clearTimers: () => {
      timers.forEach(clearTimeout);
      (globalThis as any).setTimeout = originalSetTimeout;
    },
  };
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    session: undefined,
    jwtUser: undefined,
    headers: {},
    ...overrides,
  } as Request;
}

describe("rlsContextMiddleware", () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  it("calls next() immediately when no context is available", async () => {
    const { res, clearTimers } = mockResponse();
    const req = mockRequest();
    try {
      await rlsContextMiddleware(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createRlsClient)).not.toHaveBeenCalled();
      expect(vi.mocked(runWithRlsDb)).not.toHaveBeenCalled();
    } finally {
      clearTimers();
    }
  });

  it("builds context from req.session.user and calls createRlsClient", async () => {
    const { res, clearTimers } = mockResponse();
    const req = mockRequest({
      session: { user: { id: "user-123", email: "test@example.com", role: "provider" } } as any,
    });

    try {
      await rlsContextMiddleware(req, res, mockNext);

      expect(vi.mocked(createRlsClient)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createRlsClient)).toHaveBeenCalledWith({
        userId: "user-123",
        email: "test@example.com",
        role: "provider",
      });
    } finally {
      clearTimers();
    }
  });

  it("calls runWithRlsDb when context is available from session", async () => {
    const { res, clearTimers } = mockResponse();
    const req = mockRequest({
      session: { user: { id: "user-456", email: "alice@example.com", role: "admin" } } as any,
    });

    try {
      await rlsContextMiddleware(req, res, mockNext);

      expect(vi.mocked(runWithRlsDb)).toHaveBeenCalledTimes(1);
    } finally {
      clearTimers();
    }
  });

  it("calls next via runWithRlsDb when session context exists", async () => {
    const { res, clearTimers } = mockResponse();
    const req = mockRequest({
      session: { user: { id: "user-789", email: "bob@example.com", role: "provider" } } as any,
    });

    try {
      await rlsContextMiddleware(req, res, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    } finally {
      clearTimers();
    }
  });

  it("builds context from req.jwtUser", async () => {
    const { res, clearTimers } = mockResponse();
    const req = mockRequest({
      jwtUser: { sub: "jwt-user-001", email: "jwt@example.com", role: "provider" } as any,
    });

    try {
      await rlsContextMiddleware(req, res, mockNext);

      expect(vi.mocked(createRlsClient)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createRlsClient)).toHaveBeenCalledWith({
        userId: "jwt-user-001",
        email: "jwt@example.com",
        role: "provider",
      });
    } finally {
      clearTimers();
    }
  });

  it("builds context from req.authenticatedUser when other sources are absent", async () => {
    const { res, clearTimers } = mockResponse();
    const req = mockRequest({
      authenticatedUser: { id: "auth-user-001", email: "auth@example.com", role: "admin" } as any,
    });

    try {
      await rlsContextMiddleware(req, res, mockNext);

      expect(vi.mocked(createRlsClient)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(createRlsClient)).toHaveBeenCalledWith({
        userId: "auth-user-001",
        email: "auth@example.com",
        role: "admin",
      });
    } finally {
      clearTimers();
    }
  });
});
