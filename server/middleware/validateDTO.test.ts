/**
 * server/middleware/validateDTO.test.ts
 *
 * Unit tests for validateDTO and validateQueryDTO middleware in server/middleware/validateDTO.ts.
 *
 * Covers:
 *  - validateDTO: calls next() when body passes schema validation
 *  - validateDTO: replaces req.body with parsed result from schema.parseAsync
 *  - validateDTO: returns 400 with structured errors on Zod validation failure
 *  - validateDTO: logs warning on validation failure with request path
 *  - validateDTO: returns 500 on unexpected non-Zod errors
 *  - validateQueryDTO: calls next() when query passes schema validation
 *  - validateQueryDTO: returns 400 with structured errors on query validation failure
 *  - validateQueryDTO: returns 500 on unexpected non-Zod errors in query validation
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { validateDTO, validateQueryDTO } from "./validateDTO";

// Minimal mock logger to prevent test crashes
vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Simple test schema for body validation
const personSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

// Simple test schema for query validation
const searchSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().optional(),
});

function mockReq(overrides?: { body?: unknown; query?: unknown }) {
  return {
    body: overrides?.body ?? {},
    query: overrides?.query ?? {},
  };
}

function createMockRes() {
  // Single shared object so status().json() chaining works
  const jsonMock = vi.fn();
  const statusMock = vi.fn(() => ({ json: jsonMock }));
  const jsonData: Record<string, unknown> = { _captured: null as unknown };
  return {
    status: statusMock,
    json: jsonMock,
    _jsonData: jsonData,
  };
}

function mockNext() {
  return vi.fn();
}

describe("validateDTO", () => {
  let warnSpy: ReturnType<typeof vi.fn>;
  let errorSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { logger } = await import("../logger");
    warnSpy = logger.warn;
    errorSpy = logger.error;
  });

  it("calls next() when body passes schema validation", async () => {
    const req = mockReq({ body: { name: "Alice", age: 30 } });
    const res = createMockRes();
    const next = mockNext();

    const middleware = validateDTO(personSchema);
    await middleware(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("replaces req.body with the parsed result from schema.parseAsync", async () => {
    const rawBody = { name: "Bob", age: "25" }; // age as string, will be coerced
    const req = mockReq({ body: rawBody });
    const res = createMockRes();
    const next = mockNext();

    const schemaWithCoercion = z.object({
      name: z.string(),
      age: z.coerce.number(),
    });
    const middleware = validateDTO(schemaWithCoercion);
    await middleware(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.age).toBe(25);
    expect(req.body.name).toBe("Bob");
  });

  it("returns 400 with structured errors on Zod validation failure", async () => {
    const req = mockReq({ body: { name: "", age: -5 } }); // invalid: empty name, negative age
    const res = createMockRes();
    const next = mockNext();

    const middleware = validateDTO(personSchema);
    await middleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.message).toBe("Validation failed");
    expect(jsonCall.errors).toBeDefined();
    expect(Array.isArray(jsonCall.errors)).toBe(true);
    expect(jsonCall.errors.length).toBeGreaterThan(0);
    expect(jsonCall.errors[0]).toHaveProperty("field");
    expect(jsonCall.errors[0]).toHaveProperty("message");
  });

  it("logs warning on validation failure with request path", async () => {
    const req = mockReq({ body: { name: "" } }) as any;
    req.path = "/api/test";
    const res = createMockRes();
    const next = mockNext();

    const middleware = validateDTO(personSchema);
    await middleware(req, res as any, next);

    expect(warnSpy).toHaveBeenCalled();
    const warnCall = warnSpy.mock.calls[0][0];
    expect(warnCall.path).toBe("/api/test");
    expect(warnCall.err).toBeDefined();
  });

  it("does not call next() on validation failure", async () => {
    const req = mockReq({ body: { name: "" } });
    const res = createMockRes();
    const next = mockNext();

    const middleware = validateDTO(personSchema);
    await middleware(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected non-Zod errors", async () => {
    // Create a schema that throws an unexpected error (not ZodError)
    const brokenSchema = {
      parseAsync: async () => {
        throw new Error("Unexpected DB error");
      },
    } as any;
    const req = mockReq({ body: { name: "test" } });
    const res = createMockRes();
    const next = mockNext();

    const middleware = validateDTO(brokenSchema);
    await middleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.message).toContain("Internal server error");
  });
});

describe("validateQueryDTO", () => {
  let warnSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const { logger } = await import("../logger");
    warnSpy = logger.warn;
  });

  it("calls next() when query passes schema validation", async () => {
    const req = mockReq({ query: { q: "diabetes" } });
    const res = createMockRes();
    const next = mockNext();

    const middleware = validateQueryDTO(searchSchema);
    await middleware(req as any, res as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("replaces req.query with the parsed result from schema.parseAsync", async () => {
    const req = mockReq({ query: { q: "cancer", limit: "10" } });
    const res = createMockRes();
    const next = mockNext();

    const middleware = validateQueryDTO(searchSchema);
    await middleware(req as any, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.query.limit).toBe(10);
    expect(req.query.q).toBe("cancer");
  });

  it("returns 400 with structured errors on query validation failure", async () => {
    const req = mockReq({ query: { q: "" } }); // q is required and min 1
    const res = createMockRes();
    const next = mockNext();

    const middleware = validateQueryDTO(searchSchema);
    await middleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.message).toBe("Validation failed for query parameters");
    expect(Array.isArray(jsonCall.errors)).toBe(true);
  });

  it("logs warning on query validation failure with request path", async () => {
    const req = mockReq({ query: { q: "" } }) as any;
    req.path = "/api/search";
    const res = createMockRes();
    const next = mockNext();

    const middleware = validateQueryDTO(searchSchema);
    await middleware(req, res as any, next);

    expect(warnSpy).toHaveBeenCalled();
    const warnCall = warnSpy.mock.calls[0][0];
    expect(warnCall.path).toBe("/api/search");
  });

  it("does not call next() on query validation failure", async () => {
    const req = mockReq({ query: { q: "" } });
    const res = createMockRes();
    const next = mockNext();

    const middleware = validateQueryDTO(searchSchema);
    await middleware(req as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected non-Zod errors in query validation", async () => {
    const brokenSchema = {
      parseAsync: async () => {
        throw new Error("Unexpected crash");
      },
    } as any;
    const req = mockReq({ query: { q: "test" } });
    const res = createMockRes();
    const next = mockNext();

    const middleware = validateQueryDTO(brokenSchema);
    await middleware(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
    const jsonCall = res.json.mock.calls[0][0];
    expect(jsonCall.message).toContain("Internal server error");
  });
});
