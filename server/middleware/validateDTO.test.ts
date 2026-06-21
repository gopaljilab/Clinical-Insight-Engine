import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

const { loggerWarn, loggerError, logger } = vi.hoisted(() => {
  const warn = vi.fn();
  const error = vi.fn();
  const info = vi.fn();
  return { loggerWarn: warn, loggerError: error, logger: { warn, error, info } };
});

vi.mock("../logger", () => ({ logger }));

import { validateDTO, validateQueryDTO } from "./validateDTO";

describe("validateDTO middleware", () => {
  beforeEach(() => {
    loggerWarn.mockClear();
    loggerError.mockClear();
  });

  describe("validateDTO", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    });

    it("calls next when body matches the schema", async () => {
      const next = vi.fn<NextFunction>();
      const req = {
        body: { name: "Alice", age: 30 },
      } as unknown as Request;
      const res = {} as Response;

      const middleware = validateDTO(schema);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
      expect(req.body).toEqual({ name: "Alice", age: 30 });
    });

    it("returns 400 with errors array when body does not match schema", async () => {
      const next = vi.fn<NextFunction>();
      const json = vi.fn();
      const req = {
        body: { name: "Bob" }, // missing age
      } as unknown as Request;
      const res = {
        status: vi.fn(() => ({ json })),
        json,
      } as unknown as Response;

      const middleware = validateDTO(schema);
      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        message: "Validation failed",
        errors: expect.arrayContaining([
          expect.objectContaining({ field: "age", message: expect.any(String) }),
        ]),
      });
    });

    it("returns 400 when body is completely invalid", async () => {
      const next = vi.fn<NextFunction>();
      const json = vi.fn();
      const req = {
        body: null,
        path: "/test",
      } as unknown as Request;
      const res = {
        status: vi.fn(() => ({ json })),
        json,
      } as unknown as Response;

      const middleware = validateDTO(schema);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it("logs a warning on Zod validation failure", async () => {
      const next = vi.fn<NextFunction>();
      const json = vi.fn();
      const req = {
        body: { name: 123 },
        path: "/api/test",
      } as unknown as Request;
      const res = {
        status: vi.fn(() => ({ json })),
        json,
      } as unknown as Response;

      const middleware = validateDTO(schema);
      await middleware(req, res, next);

      expect(loggerWarn).toHaveBeenCalledTimes(1);
      expect(loggerWarn.mock.calls[0][0].path).toBe("/api/test");
    });
  });

  describe("validateQueryDTO", () => {
    const querySchema = z.object({
      page: z.coerce.number().int().positive(),
      limit: z.coerce.number().int().positive().max(100).optional(),
    });

    it("calls next when query matches the schema", async () => {
      const next = vi.fn<NextFunction>();
      const req = {
        query: { page: "5", limit: "20" },
      } as unknown as Request;
      const res = {} as Response;

      const middleware = validateQueryDTO(querySchema);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith();
    });

    it("returns 400 with errors when query is invalid", async () => {
      const next = vi.fn<NextFunction>();
      const json = vi.fn();
      const req = {
        query: { page: "-1" },
        path: "/api/search",
      } as unknown as Request;
      const res = {
        status: vi.fn(() => ({ json })),
        json,
      } as unknown as Response;

      const middleware = validateQueryDTO(querySchema);
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        message: "Validation failed for query parameters",
        errors: expect.any(Array),
      });
    });

    it("coerces string query params to numbers via z.coerce", async () => {
      const next = vi.fn<NextFunction>();
      const req = {
        query: { page: "10" },
      } as unknown as Request;
      const res = {} as Response;

      const middleware = validateQueryDTO(querySchema);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.query).toEqual({ page: 10 });
    });
  });
});
