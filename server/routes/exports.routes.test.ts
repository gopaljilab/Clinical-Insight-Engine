import { describe, expect, it, vi, beforeEach } from "vitest";

// All hoisted variables must be declared via vi.hoisted so vi.mock() can access them
const mocks = vi.hoisted(() => {
  const mockGetAssessments = vi.fn();
  const mockAssessmentsToCsv = vi.fn(() => "name,age\nexample,45\n");
  const mockExportLimiter = vi.fn((_req, _res, next) => next());
  const mockRequireAuth = vi.fn();
  const mockRequireVerified = vi.fn();
  return {
    mockGetAssessments,
    mockAssessmentsToCsv,
    mockExportLimiter,
    mockRequireAuth,
    mockRequireVerified,
    mockStorage: { getAssessments: mockGetAssessments },
  };
});

vi.mock("../storage", () => ({ storage: mocks.mockStorage }));
vi.mock("../utils/csvExport", () => ({ assessmentsToCsv: mocks.mockAssessmentsToCsv }));
vi.mock("../middleware/rateLimit", () => ({ exportLimiter: mocks.mockExportLimiter }));
vi.mock("../auth", () => ({
  requireAuth: mocks.mockRequireAuth,
  requireVerified: mocks.mockRequireVerified,
}));

import exportsRouter from "./exports.routes";
import request from "supertest";
import express from "express";

function buildApp(withSession = false) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (withSession) {
      req.session = { user: { email: "test@example.com", id: "1" } };
    }
    next();
  });
  app.use("/api", exportsRouter);
  return app;
}

describe("GET /api/export.csv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireAuth.mockImplementation((req, res, next) => {
      if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "Authentication required." });
      }
      next();
    });
    mocks.mockRequireVerified.mockImplementation((_req, _res, next) => next());
  });

  it("returns 401 when unauthenticated", async () => {
    const app = buildApp(false);
    const res = await request(app).get("/api/export.csv");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Authentication required.");
  });

  it("returns 200 with CSV content-type when authenticated", async () => {
    mocks.mockGetAssessments.mockResolvedValue({ data: [], nextCursor: null });
    const app = buildApp(true);
    const res = await request(app).get("/api/export.csv");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
  });

  it("returns CSV string as body", async () => {
    mocks.mockGetAssessments.mockResolvedValue({ data: [{ patientName: "Alice", age: 30 }], nextCursor: null });
    mocks.mockAssessmentsToCsv.mockReturnValue("patientName,age\nAlice,30\n");
    const app = buildApp(true);
    const res = await request(app).get("/api/export.csv");
    expect(res.status).toBe(200);
    expect(res.text).toContain("patientName");
  });

  it("calls storage.getAssessments with createdBy from session", async () => {
    mocks.mockGetAssessments.mockResolvedValue({ data: [], nextCursor: null });
    const app = buildApp(true);
    await request(app).get("/api/export.csv");
    expect(mocks.mockGetAssessments).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "test@example.com" }),
    );
  });

  it("sets Content-Disposition attachment header", async () => {
    mocks.mockGetAssessments.mockResolvedValue({ data: [], nextCursor: null });
    const app = buildApp(true);
    const res = await request(app).get("/api/export.csv");
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
  });
});
