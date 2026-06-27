import { describe, expect, it, vi, beforeEach } from "vitest";
import { seedDatabase } from "./seed";
import { logger } from "../logger";

// Use vi.hoisted so mocks are available before vi.mock is hoisted
const mocks = vi.hoisted(() => {
  const mockGetAssessments = vi.fn();
  const mockCreateAssessment = vi.fn();
  return { mockGetAssessments, mockCreateAssessment };
});

vi.mock("../storage", () => ({
  storage: {
    getAssessments: mocks.mockGetAssessments,
    createAssessment: mocks.mockCreateAssessment,
  },
}));

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("seedDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when assessments already exist", async () => {
    mocks.mockGetAssessments.mockResolvedValueOnce({ data: [{ id: 1 }] });
    await seedDatabase();
    expect(mocks.mockGetAssessments).toHaveBeenCalledTimes(1);
    expect(mocks.mockCreateAssessment).not.toHaveBeenCalled();
  });

  it("returns early when getAssessments returns a non-empty array directly", async () => {
    mocks.mockGetAssessments.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    await seedDatabase();
    expect(mocks.mockGetAssessments).toHaveBeenCalledTimes(1);
    expect(mocks.mockCreateAssessment).not.toHaveBeenCalled();
  });

  it("seeds two sample assessments when database is empty", async () => {
    mocks.mockGetAssessments.mockResolvedValueOnce({ data: [] });
    await seedDatabase();
    expect(mocks.mockCreateAssessment).toHaveBeenCalledTimes(2);
  });

  it("seeds John Doe and Mary Johnson as the two sample patients", async () => {
    mocks.mockGetAssessments.mockResolvedValueOnce({ data: [] });
    await seedDatabase();
    const calls = mocks.mockCreateAssessment.mock.calls;
    expect(calls[0][0].patientName).toBe("John Doe");
    expect(calls[0][0].gender).toBe("Male");
    expect(calls[0][0].riskCategory).toBe("LOW");
    expect(calls[1][0].patientName).toBe("Mary Johnson");
    expect(calls[1][0].gender).toBe("Female");
    expect(calls[1][0].riskCategory).toBe("MODERATE");
  });

  it("seeds assessments with the correct seed user ID", async () => {
    mocks.mockGetAssessments.mockResolvedValueOnce({ data: [] });
    await seedDatabase();
    const calls = mocks.mockCreateAssessment.mock.calls;
    expect(calls[0][0].createdBy).toBe("seed@clinical-insight-engine.dev");
    expect(calls[1][0].createdBy).toBe("seed@clinical-insight-engine.dev");
  });

  it("logs info messages during seeding", async () => {
    mocks.mockGetAssessments.mockResolvedValueOnce({ data: [] });
    await seedDatabase();
    expect(logger.info).toHaveBeenCalledWith("Seeding database with sample assessments...");
    expect(logger.info).toHaveBeenCalledWith("Seeding complete!");
  });

  it("does not log seeding messages when already seeded", async () => {
    mocks.mockGetAssessments.mockResolvedValueOnce({ data: [{ id: 99 }] });
    await seedDatabase();
    expect(logger.info).not.toHaveBeenCalledWith("Seeding database with sample assessments...");
  });

  it("handles null response from getAssessments gracefully", async () => {
    mocks.mockGetAssessments.mockResolvedValueOnce(null);
    await seedDatabase();
    expect(mocks.mockCreateAssessment).toHaveBeenCalledTimes(2);
  });

  it("handles undefined data property gracefully", async () => {
    mocks.mockGetAssessments.mockResolvedValueOnce({});
    await seedDatabase();
    expect(mocks.mockCreateAssessment).toHaveBeenCalledTimes(2);
  });
});
