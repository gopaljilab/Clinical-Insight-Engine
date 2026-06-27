import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateDTO, validateQueryDTO } from "./validateDTO";

// --- Mock logger ---
const { mockLogger } = vi.hoisted(() => {
  return {
    mockLogger: {
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock("../logger", () => ({
  logger: mockLogger,
}));

// Helper to build a mock Response
function mockResponse() {
  const res: Partial<Response> = {
    statusCode: 200,
    _status: 200,
  };
  res.status = vi.fn(function(this: any, code: number) {
    this._status = code;
    return this;
  }) as any;
  res.json = vi.fn(function(this: any, body: any) {
    this._body = body;
    return this;
  }) as any;
  return res as Response;
}

// Helper to build a mock Request
function mockRequest(body: unknown = {}, query: unknown = {}): Partial<Request> {
  return {
    body,
    query,
    path: "/test",
  } as Partial<Request>;
}

// Helper mock NextFunction
function mockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateDTO", () => {
  const schema = z.object({ name: z.string(), age: z.number() });

  it("calls next() when validation succeeds", async () => {
    const req = mockRequest({ name: "Alice", age: 30 });
    const res = mockResponse();
    const next = mockNext();

    await validateDTO(schema)(req as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).body.name).toBe("Alice");
    expect((req as any).body.age).toBe(30);
  });

  it("replaces req.body with parsed result", async () => {
    const req = mockRequest({ name: "Bob", age: 25 });
    const res = mockResponse();
    const next = mockNext();

    await validateDTO(schema)(req as Request, res, next);

    expect((req as any).body).toEqual({ name: "Bob", age: 25 });
  });

  it("returns 400 with field-level errors on validation failure", async () => {
    const req = mockRequest({ name: "Carol", age: "not-a-number" });
    const res = mockResponse();
    const next = mockNext();

    await validateDTO(schema)(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    const body = (res.json as any).mock.calls[0][0];
    expect(body.message).toBe("Validation failed.");
    expect(body.errors).toBeDefined();
    expect(Array.isArray(body.errors)).toBe(true);
  });

  it("maps ZodError.errors to {field, message} shape", async () => {
    const req = mockRequest({ name: 123, age: "bad" });
    const res = mockResponse();
    const next = mockNext();

    await validateDTO(schema)(req as Request, res, next);

    const body = (res.json as any).mock.calls[0][0];
    expect(body.errors[0]).toHaveProperty("field");
    expect(body.errors[0]).toHaveProperty("message");
  });

  it("does not call next() on validation failure", async () => {
    const req = mockRequest({ name: 123 });
    const res = mockResponse();
    const next = mockNext();

    await validateDTO(schema)(req as Request, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("logs warning on validation failure", async () => {
    const req = mockRequest({ name: 123 });
    const res = mockResponse();
    const next = mockNext();

    await validateDTO(schema)(req as Request, res, next);

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on unexpected non-Zod errors", async () => {
    const badSchema = { parseAsync: async () => { throw new Error("Unexpected"); } } as any;
    const req = mockRequest({ name: "Test" });
    const res = mockResponse();
    const next = mockNext();

    await validateDTO(badSchema)(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error during validation" });
  });

  it("logs error on unexpected non-Zod errors", async () => {
    const badSchema = { parseAsync: async () => { throw new Error("Unexpected"); } } as any;
    const req = mockRequest({ name: "Test" });
    const res = mockResponse();
    const next = mockNext();

    await validateDTO(badSchema)(req as Request, res, next);

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });
});

describe("validateQueryDTO", () => {
  const querySchema = z.object({ page: z.coerce.number().optional(), filter: z.string().optional() });

  it("calls next() when query validation succeeds", async () => {
    const req = mockRequest({}, { page: "2", filter: "active" });
    const res = mockResponse();
    const next = mockNext();

    await validateQueryDTO(querySchema)(req as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("replaces req.query with parsed result", async () => {
    const req = mockRequest({}, { page: "3" });
    const res = mockResponse();
    const next = mockNext();

    await validateQueryDTO(querySchema)(req as Request, res, next);

    expect((req as any).query.page).toBe(3);
  });

  it("returns 400 on query validation failure", async () => {
    const req = mockRequest({}, { page: "abc" });
    const res = mockResponse();
    const next = mockNext();

    await validateQueryDTO(querySchema)(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
  });

  it("maps ZodError.errors to {field, message} shape on query failure", async () => {
    const req = mockRequest({}, { page: "abc" });
    const res = mockResponse();
    const next = mockNext();

    await validateQueryDTO(querySchema)(req as Request, res, next);

    const body = (res.json as any).mock.calls[0][0];
    expect(body.errors[0]).toHaveProperty("field");
    expect(body.errors[0]).toHaveProperty("message");
  });

  it("does not call next() on query validation failure", async () => {
    const req = mockRequest({}, { page: "abc" });
    const res = mockResponse();
    const next = mockNext();

    await validateQueryDTO(querySchema)(req as Request, res, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected non-Zod errors in query validation", async () => {
    const badSchema = { parseAsync: async () => { throw new Error("Unexpected query error"); } } as any;
    const req = mockRequest({}, {});
    const res = mockResponse();
    const next = mockNext();

    await validateQueryDTO(badSchema)(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
