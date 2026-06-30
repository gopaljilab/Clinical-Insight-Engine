import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateDTO, validateQueryDTO } from "./validateDTO";

// --- Mock logger ---
vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function mockResponse() {
  const res = {
    _status: 200,
    _body: null as any,
  } as unknown as Response;
  (res as any).status = function(code: number) {
    (res as any)._status = code;
    return this;
  };
  (res as any).json = function(body: any) {
    (res as any)._body = body;
    return this;
  };
  return res;
}

function mockRequest(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

function mockNext(): NextFunction {
  return vi.fn();
}

describe("validateDTO", () => {
  it("calls next() when schema.parseAsync succeeds", async () => {
    const schema = z.object({ name: z.string() });
    const middleware = validateDTO(schema);
    const req = mockRequest({ body: { name: "Alice" } });
    const res = mockResponse();
    const next = mockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("does not modify body when validation succeeds", async () => {
    const schema = z.object({ age: z.number() });
    const middleware = validateDTO(schema);
    const req = mockRequest({ body: { age: 30 } });
    const res = mockResponse();
    const next = mockNext();

    await middleware(req, res, next);

    expect(req.body).toEqual({ age: 30 });
  });

  it("returns 400 when Zod validation fails", async () => {
    const schema = z.object({ name: z.string().min(1) });
    const middleware = validateDTO(schema);
    const req = mockRequest({ body: { name: "" } });
    const res = mockResponse();
    const next = mockNext();

    await middleware(req, res, next);

    expect((res as any)._status).toBe(400);
    expect((res as any)._body.message).toBe("Validation failed.");
    expect(Array.isArray((res as any)._body.errors)).toBe(true);
  });

  it("returns structured field errors on Zod failure", async () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(0),
    });
    const middleware = validateDTO(schema);
    const req = mockRequest({ body: { email: "not-an-email", age: -5 } });
    const res = mockResponse();
    const next = mockNext();

    await middleware(req, res, next);

    expect((res as any)._status).toBe(400);
    const errors = (res as any)._body.errors;
    expect(errors.length).toBeGreaterThan(0);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 when non-Zod error is thrown", async () => {
    const schema = z.object({ name: z.string() }).transform(() => {
      throw new Error("Unexpected transform error");
    });
    const middleware = validateDTO(schema);
    const req = mockRequest({ body: { name: "test" } });
    const res = mockResponse();
    const next = mockNext();

    await middleware(req, res, next);

    expect((res as any)._status).toBe(500);
    expect((res as any)._body.message).toBe("Internal server error during validation");
  });

  it("parses and replaces req.body with parsed result", async () => {
    const schema = z.object({
      age: z.coerce.number(),
    });
    const middleware = validateDTO(schema);
    const req = mockRequest({ body: { age: "42" } });
    const res = mockResponse();
    const next = mockNext();

    await middleware(req, res, next);

    expect(req.body.age).toBe(42);
    expect(next).toHaveBeenCalled();
  });
});

describe("validateQueryDTO", () => {
  it("calls next() when query schema validates", async () => {
    const schema = z.object({ page: z.coerce.number().optional() });
    const middleware = validateQueryDTO(schema);
    const req = mockRequest({ query: { page: "5" } });
    const res = mockResponse();
    const next = mockNext();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("does not modify query when validation succeeds", async () => {
    const schema = z.object({ q: z.string().optional() });
    const middleware = validateQueryDTO(schema);
    const req = mockRequest({ query: { q: "search" } });
    const res = mockResponse();
    const next = mockNext();

    await middleware(req, res, next);

    expect(req.query).toEqual({ q: "search" });
  });

  it("returns 400 when query validation fails", async () => {
    const schema = z.object({ page: z.coerce.number().min(1) });
    const middleware = validateQueryDTO(schema);
    const req = mockRequest({ query: { page: "0" } });
    const res = mockResponse();
    const next = mockNext();

    await middleware(req, res, next);

    expect((res as any)._status).toBe(400);
    expect((res as any)._body.message).toBe("Validation failed.");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 when non-Zod error occurs during query validation", async () => {
    const schema = z.object({ q: z.string() }).transform(() => {
      throw new Error("Unexpected query transform error");
    });
    const middleware = validateQueryDTO(schema);
    const req = mockRequest({ query: { q: "test" } });
    const res = mockResponse();
    const next = mockNext();

    await middleware(req, res, next);

    expect((res as any)._status).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });
});
