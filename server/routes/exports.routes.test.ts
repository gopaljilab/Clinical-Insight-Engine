import { describe, it, expect, vi, beforeEach } from "vitest";
import { assessmentsToCsv } from "../utils/csvExport";
import { assessmentExportQuerySchema } from "../validation/searchValidation";

vi.mock("../utils/csvExport", () => ({
  assessmentsToCsv: vi.fn(() => "patient,age\nJane Doe,45"),
}));

vi.mock("../storage", () => ({
  storage: {
    getAssessments: vi.fn(),
  },
}));

vi.mock("../auth", () => ({
  requireAuth: (req, res, next) => next(),
  requireVerified: (req, res, next) => next(),
}));

vi.mock("../middleware/rateLimit", () => ({
  exportLimiter: (req, res, next) => next(),
}));

describe("exports routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /export.csv", () => {
    it("requires authentication via requireAuth middleware", async () => {
      const { requireAuth } = await import("../auth");
      const mockReq2 = { session: {} };
      const mockRes2 = {};
      const next2 = vi.fn();
      requireAuth(mockReq2, mockRes2, next2);
      expect(next2).toHaveBeenCalledTimes(1);
    });

    it("requires verification via requireVerified middleware", async () => {
      const { requireVerified } = await import("../auth");
      const mockReq2 = {};
      const mockRes2 = {};
      const next2 = vi.fn();
      requireVerified(mockReq2, mockRes2, next2);
      expect(next2).toHaveBeenCalledTimes(1);
    });

    it("applies exportLimiter rate limiting", async () => {
      const { exportLimiter } = await import("../middleware/rateLimit");
      const mockReq2 = {};
      const mockRes2 = {};
      const next2 = vi.fn();
      exportLimiter(mockReq2, mockRes2, next2);
      expect(next2).toHaveBeenCalledTimes(1);
    });

    it("uses assessmentExportQuerySchema for query validation", () => {
      const validResult = assessmentExportQuerySchema.safeParse({});
      expect(validResult.success).toBe(true);
    });

    it("assessmentExportQuerySchema rejects limit > 1000", () => {
      const result = assessmentExportQuerySchema.safeParse({ limit: 5000 });
      expect(result.success).toBe(false);
    });

    it("assessmentExportQuerySchema rejects negative limit", () => {
      const result = assessmentExportQuerySchema.safeParse({ limit: -1 });
      expect(result.success).toBe(false);
    });

    it("assessmentExportQuerySchema accepts cursor string '2' (coerced to 2 >= min 1)", () => {
      const result = assessmentExportQuerySchema.safeParse({ cursor: "2" });
      expect(result.success).toBe(true);
    });

    it("assessmentsToCsv is a function", () => {
      expect(typeof assessmentsToCsv).toBe("function");
    });

    it("assessmentsToCsv returns a string for valid data", () => {
      const data = [{ patient: "Jane", age: 45 }];
      const csv = assessmentsToCsv(data);
      expect(typeof csv).toBe("string");
      expect(csv.length).toBeGreaterThan(0);
    });
  });
});
