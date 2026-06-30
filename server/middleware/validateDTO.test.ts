import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { ZodError } from "zod";
import { validateDTO, validateQueryDTO } from "./validateDTO";

// --- Mock logger ---
vi.mock("../logger", () => {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

const mockLogger = vi.mocked((await import("../logger")).logger);

describe("validateDTO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses valid body and calls next", async () => {
    const parsedBody = { name: "Alice" };
    const mockSchema = {
      parseAsync: vi.fn().mockResolvedValue(parsedBody),
    };
    const req = { body: { raw: "input" }, path: "/test" } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    await validateDTO(mockSchema as any)(req, res, next);

    expect(mockSchema.parseAsync).toHaveBeenCalledWith({ raw: "input" });
    expect(req.body).toEqual(parsedBody);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 400 with validation errors for ZodError", async () => {
    const zodErrors = new ZodError([
      { path: ["name"], message: "Required", code: "invalid_type" } as any,
      { path: ["age"], message: "Must be number", code: "invalid_type" } as any,
    ]);
    const mockSchema = {
      parseAsync: vi.fn().mockRejectedValue(zodErrors),
    };
    const req = { body: {}, path: "/test" } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    await validateDTO(mockSchema as any)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Validation failed.",
      errors: [
        { field: "name", message: "Required" },
        { field: "age", message: "Must be number" },
      ],
    });
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 for non-Zod errors", async () => {
    const mockSchema = {
      parseAsync: vi.fn().mockRejectedValue(new Error("database error")),
    };
    const req = { body: {}, path: "/test" } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    await validateDTO(mockSchema as any)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error during validation" });
    expect(mockLogger.error).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});

describe("validateQueryDTO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses valid query and calls next", async () => {
    const parsedQuery = { page: 1, limit: 10 };
    const mockSchema = {
      parseAsync: vi.fn().mockResolvedValue(parsedQuery),
    };
    const req = { query: { page: "1" }, path: "/test" } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    await validateQueryDTO(mockSchema as any)(req, res, next);

    expect(mockSchema.parseAsync).toHaveBeenCalledWith({ page: "1" });
    expect(req.query).toEqual(parsedQuery);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 400 with validation errors for ZodError", async () => {
    const zodErrors = new ZodError([
      { path: ["page"], message: "Must be positive integer", code: "invalid_type" } as any,
    ]);
    const mockSchema = {
      parseAsync: vi.fn().mockRejectedValue(zodErrors),
    };
    const req = { query: {}, path: "/test" } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    await validateQueryDTO(mockSchema as any)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Validation failed.",
      errors: [
        { field: "page", message: "Must be positive integer" },
      ],
    });
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 500 for non-Zod errors without logging", async () => {
    const mockSchema = {
      parseAsync: vi.fn().mockRejectedValue(new Error("unexpected failure")),
    };
    const req = { query: {}, path: "/test" } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;
    const next = vi.fn();

    await validateQueryDTO(mockSchema as any)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error during query validation" });
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
