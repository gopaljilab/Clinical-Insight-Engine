import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

vi.mock("pino", () => {
  const mockInfo = vi.fn();
  const mockWarn = vi.fn();
  const mockError = vi.fn();
  return {
    default: Object.assign(
      () => ({
        info: mockInfo,
        warn: mockWarn,
        error: mockError,
        child: () => ({ info: mockInfo, warn: mockWarn, error: mockError }),
      }),
      { stdTimeFunctions: { isoTime: () => "iso-time" } }
    ),
  };
});

import { validateDTO, validateQueryDTO } from "./validateDTO";
import pino from "pino";

const getMockLogger = () => (vi.mocked(pino) as any)();

function mockResponse() {
  let statusCode = 200;
  let jsonBody: unknown = undefined;
  let jsonCalled = false;
  let statusCalled = false;

  const res = {
    get statusCode() { return statusCode; },
    set statusCode(code: number) { statusCode = code; },
    status(code: number) {
      statusCode = code;
      statusCalled = true;
      return res;
    },
    json(body: unknown) {
      jsonBody = body;
      jsonCalled = true;
      return res;
    },
    get jsonCalled() { return jsonCalled; },
    get statusCalled() { return statusCalled; },
    get jsonBody() { return jsonBody; },
  } as unknown as Response;

  return { res, get statusCode() { return statusCode; }, jsonBody, jsonCalled, statusCalled };
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    path: "/api/test",
    ...overrides,
  } as Request;
}

describe("validateDTO", () => {
  let mockNext: NextFunction;
  let schema: z.ZodTypeAny;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
    schema = z.object({ name: z.string(), age: z.number() });
  });

  it("calls next() when body is valid against the schema", async () => {
    const { res } = mockResponse();
    const req = mockRequest({ body: { name: "Alice", age: 30 } });

    await validateDTO(schema)(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(res.jsonCalled).toBe(false);
  });

  it("returns 400 with field-level errors when body is invalid", async () => {
    const { res } = mockResponse();
    const req = mockRequest({ body: { name: 123, age: "not-a-number" } });

    await validateDTO(schema)(req, res, mockNext);

    expect(res.statusCode).toBe(400);
    expect(res.jsonCalled).toBe(true);
    expect(res.jsonBody).toEqual({
      message: "Validation failed.",
      errors: expect.arrayContaining([
        expect.objectContaining({ field: "name", message: expect.any(String) }),
        expect.objectContaining({ field: "age", message: expect.any(String) }),
      ]),
    });
  });

  it("returns 400 for a single validation error", async () => {
    const { res } = mockResponse();
    const req = mockRequest({ body: { age: 25 } }); // missing required 'name'

    await validateDTO(schema)(req, res, mockNext);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toMatchObject({
      message: "Validation failed.",
      errors: expect.arrayContaining([
        expect.objectContaining({ field: "name" }),
      ]),
    });
  });

  it("does not call next() when validation fails", async () => {
    const { res } = mockResponse();
    const req = mockRequest({ body: { name: 999 } });

    await validateDTO(schema)(req, res, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
  });

  it("does not call next() when non-Zod error is thrown", async () => {
    const { res } = mockResponse();
    const req = mockRequest({ body: { name: "Bob", age: 40 } });
    const brokenSchema = {
      parseAsync: async () => { throw new Error("unexpected"); },
    };

    await validateDTO(brokenSchema as any)(req, res, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toEqual({ message: "Internal server error during validation" });
  });
});

describe("validateQueryDTO", () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  it("calls next() when query is valid against the schema", async () => {
    const { res } = mockResponse();
    const req = mockRequest({ query: { page: "1", limit: "10" } });
    const schema = z.object({ page: z.string(), limit: z.string() });

    await validateQueryDTO(schema)(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
    expect(res.jsonCalled).toBe(false);
  });

  it("returns 400 with field-level errors when query is invalid", async () => {
    const { res } = mockResponse();
    const req = mockRequest({ query: { page: 123 } }); // should be string
    const schema = z.object({ page: z.string() });

    await validateQueryDTO(schema)(req, res, mockNext);

    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toEqual({
      message: "Validation failed.",
      errors: expect.arrayContaining([
        expect.objectContaining({ field: "page", message: expect.any(String) }),
      ]),
    });
  });

  it("returns 500 for unexpected non-Zod errors in query validation", async () => {
    const { res } = mockResponse();
    const req = mockRequest({ query: { foo: "bar" } });
    const brokenSchema = {
      parseAsync: async () => { throw new Error("boom"); },
    };

    await validateQueryDTO(brokenSchema as any)(req, res, mockNext);

    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toEqual({ message: "Internal server error during query validation" });
  });
});
