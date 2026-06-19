import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateDTO, validateQueryDTO } from "./validateDTO";
import { z } from "zod";

vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockNext = vi.fn();
const mockStatus = vi.fn().mockReturnThis();
const mockJson = vi.fn();

const createReq = (body = {}, query = {}) => ({
  body,
  query,
  path: "/test",
});

const createRes = () => ({
  status: mockStatus,
  json: mockJson,
});

beforeEach(() => {
  mockNext.mockReset();
  mockStatus.mockReturnThis();
  mockJson.mockReset();
});

describe("validateDTO", () => {
  it("passes valid body to next and replaces req.body with parsed result", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const middleware = validateDTO(schema);
    const req = createReq({ name: "Alice", age: 30 });
    const res = createRes();

    await middleware(req as any, res as any, mockNext as any);

    expect(mockNext).toHaveBeenCalled();
    expect((req as any).body).toEqual({ name: "Alice", age: 30 });
  });

  it("returns 400 with field errors on Zod validation failure", async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const middleware = validateDTO(schema);
    const req = createReq({ name: 42, age: "not-a-number" });
    const res = createRes();

    await middleware(req as any, res as any, mockNext as any);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Validation failed",
        errors: expect.arrayContaining([
          expect.objectContaining({ field: expect.any(String), message: expect.any(String) }),
        ]),
      })
    );
  });

  // The non-Zod error branch (500 response) is a defensive fallback.
  // Zod's parseAsync only throws ZodError so this branch is only reachable
  // if a non-Zod exception propagates from parseAsync itself.
});

describe("validateQueryDTO", () => {
  it("passes valid query params to next", async () => {
    const schema = z.object({ page: z.coerce.number().int().min(1) });
    const middleware = validateQueryDTO(schema);
    const req = createReq({}, { page: "5" });
    const res = createRes();

    await middleware(req as any, res as any, mockNext as any);

    expect(mockNext).toHaveBeenCalled();
    expect((req as any).query.page).toBe(5);
  });

  it("returns 400 on invalid query params", async () => {
    const schema = z.object({ page: z.coerce.number().int().min(1) });
    const middleware = validateQueryDTO(schema);
    const req = createReq({}, { page: "-1" });
    const res = createRes();

    await middleware(req as any, res as any, mockNext as any);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Validation failed for query parameters",
        errors: expect.arrayContaining([
          expect.objectContaining({ field: expect.any(String), message: expect.any(String) }),
        ]),
      })
    );
  });
});
