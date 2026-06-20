import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { validateDTO, validateQueryDTO } from "./validateDTO";

describe("validateDTO", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  beforeEach(() => {
    mockReq = { body: {}, path: "/test" };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    nextFn = vi.fn();
  });

  it("calls next when body matches schema", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    mockReq.body = { name: "Alice", age: 30 };
    const middleware = validateDTO(schema);
    await middleware(mockReq as Request, mockRes as Response, nextFn);
    expect(nextFn).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("returns 400 with Zod errors when body is invalid", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    mockReq.body = { name: 123, age: "not-a-number" };
    const middleware = validateDTO(schema);
    await middleware(mockReq as Request, mockRes as Response, nextFn);
    expect(nextFn).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Validation failed" })
    );
  });

  it("returns 500 when non-Zod error is thrown", async () => {
    const schema = z.object({ name: z.string() });
    // Force a non-Zod error by making schema.parseAsync throw something unexpected
    const brokenSchema = {
      parseAsync: vi.fn().mockRejectedValue(new Error("unexpected")),
    } as any;
    mockReq.body = { name: "test" };
    const middleware = validateDTO(brokenSchema);
    await middleware(mockReq as Request, mockRes as Response, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});

describe("validateQueryDTO", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFn: NextFunction;

  beforeEach(() => {
    mockReq = { query: {}, path: "/search" };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    nextFn = vi.fn();
  });

  it("calls next when query matches schema", async () => {
    const schema = z.object({ q: z.string(), page: z.string().optional() });
    mockReq.query = { q: "diabetes", page: "2" };
    const middleware = validateQueryDTO(schema);
    await middleware(mockReq as Request, mockRes as Response, nextFn);
    expect(nextFn).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it("returns 400 with Zod errors when query is invalid", async () => {
    const schema = z.object({ q: z.string() });
    mockReq.query = { q: 999 }; // should be string
    const middleware = validateQueryDTO(schema);
    await middleware(mockReq as Request, mockRes as Response, nextFn);
    expect(nextFn).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Validation failed for query parameters" })
    );
  });

  it("returns 500 on unexpected non-Zod error", async () => {
    const brokenSchema = {
      parseAsync: vi.fn().mockRejectedValue(new Error("surprise")),
    } as any;
    const middleware = validateQueryDTO(brokenSchema);
    await middleware(mockReq as Request, mockRes as Response, nextFn);
    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
