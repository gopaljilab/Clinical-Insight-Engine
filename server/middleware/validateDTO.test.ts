import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateDTO, validateQueryDTO } from "./validateDTO";

// --- Mock logger ---
vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function mockResponse() {
  let statusCode = 200;
  let jsonPayload: unknown = null;
  const res = {
    statusCode,
    _status: 200,
    _body: null as unknown,
    status: function (code: number) {
      statusCode = code;
      this._status = code;
      return this;
    },
    json: function (body: unknown) {
      jsonPayload = body;
      this._body = body;
      return this;
    },
  } as unknown as Response;
  return { res, getStatus: () => statusCode, getJson: () => jsonPayload };
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: "POST",
    path: "/api/test",
    body: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

describe("validateDTO", () => {
  let nextFn: NextFunction;

  beforeEach(() => {
    nextFn = vi.fn();
  });

  it("calls next() when body passes Zod validation", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const req = mockRequest({ body: { name: "Alice", age: 30 } });
    const { res } = mockResponse();

    const middleware = validateDTO(schema);
    await middleware(req, res, nextFn);

    expect(nextFn).toHaveBeenCalled();
    expect(req.body).toEqual({ name: "Alice", age: 30 });
  });

  it("returns 400 when body fails Zod validation", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const req = mockRequest({ body: { name: "Alice" } }); // age is missing
    const { res, getStatus, getJson } = mockResponse();

    const middleware = validateDTO(schema);
    await middleware(req, res, nextFn);

    expect(nextFn).not.toHaveBeenCalled();
    expect(getStatus()).toBe(400);
    expect(getJson()).toHaveProperty("message", "Validation failed.");
    expect(getJson()).toHaveProperty("errors");
  });

  it("returns 500 when a non-Zod error is thrown", async () => {
    const req = mockRequest({ body: { name: "Bob" } });
    const { res, getStatus, getJson } = mockResponse();

    // Pass a schema whose parseAsync throws a non-Zod Error
    const badSchema = {
      parseAsync: async () => {
        throw new Error("unexpected error");
      },
    } as z.ZodTypeAny;

    const middleware = validateDTO(badSchema);
    await middleware(req, res, nextFn);

    expect(nextFn).not.toHaveBeenCalled();
    expect(getStatus()).toBe(500);
    expect(getJson()).toHaveProperty("message", "Internal server error during validation");
  });

  it("returns 400 with field-level errors on partial Zod failure", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const req = mockRequest({ body: { name: 123, age: "not-a-number" } });
    const { res, getJson } = mockResponse();

    const middleware = validateDTO(schema);
    await middleware(req, res, nextFn);

    expect(getJson()).toHaveProperty("errors");
    expect(Array.isArray((getJson() as any).errors)).toBe(true);
  });
});

describe("validateQueryDTO", () => {
  let nextFn: NextFunction;

  beforeEach(() => {
    nextFn = vi.fn();
  });

  it("calls next() when query passes Zod validation", async () => {
    const schema = z.object({ page: z.string(), limit: z.string() });
    const req = mockRequest({ query: { page: "1", limit: "10" } });
    const { res } = mockResponse();

    const middleware = validateQueryDTO(schema);
    await middleware(req, res, nextFn);

    expect(nextFn).toHaveBeenCalled();
  });

  it("returns 400 when query fails Zod validation", async () => {
    const schema = z.object({ page: z.string() });
    const req = mockRequest({ query: { page: 123 } }); // must be string
    const { res, getStatus, getJson } = mockResponse();

    const middleware = validateQueryDTO(schema);
    await middleware(req, res, nextFn);

    expect(nextFn).not.toHaveBeenCalled();
    expect(getStatus()).toBe(400);
    expect(getJson()).toHaveProperty("message", "Validation failed.");
  });

  it("returns 500 when a non-Zod error is thrown", async () => {
    const req = mockRequest({ query: { page: "1" } });
    const { res, getStatus, getJson } = mockResponse();

    const badSchema = {
      parseAsync: async () => {
        throw new Error("unexpected query error");
      },
    } as z.ZodTypeAny;

    const middleware = validateQueryDTO(badSchema);
    await middleware(req, res, nextFn);

    expect(nextFn).not.toHaveBeenCalled();
    expect(getStatus()).toBe(500);
    expect(getJson()).toHaveProperty("message", "Internal server error during query validation");
  });
});
