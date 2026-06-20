import { describe, it, expect, vi, beforeEach } from "vitest";
import { seedDatabase } from "./seed";

const mockGetAssessments = vi.fn();
const mockCreateAssessment = vi.fn();
const mockLoggerInfo = vi.fn();

vi.mock("../logger", () => ({
  logger: {
    info: (...args: any[]) => mockLoggerInfo(...args),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getAssessments: (...args: any[]) => mockGetAssessments(...args),
    createAssessment: (...args: any[]) => mockCreateAssessment(...args),
  },
}));

describe("seedDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early when assessments already exist (idempotency)", async () => {
    mockGetAssessments.mockResolvedValue({
      data: [{ id: 1, patientName: "Existing Patient" }],
    });

    await seedDatabase();

    expect(mockGetAssessments).toHaveBeenCalledWith(1);
    expect(mockCreateAssessment).not.toHaveBeenCalled();
    expect(mockLoggerInfo).not.toHaveBeenCalled();
  });

  it("seeds two sample assessments when the database is empty", async () => {
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    expect(mockCreateAssessment).toHaveBeenCalledTimes(2);
  });

  it("seeds with correct createdBy (seed user email)", async () => {
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    const firstCall = mockCreateAssessment.mock.calls[0][0];
    expect(firstCall.createdBy).toBe("seed@clinical-insight-engine.dev");
  });

  it("seeds with correct patient names", async () => {
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    const calls = mockCreateAssessment.mock.calls;
    const patientNames = calls.map((c: any[]) => c[0].patientName);
    expect(patientNames).toContain("John Doe");
    expect(patientNames).toContain("Mary Johnson");
  });

  it("seeds first record with LOW riskCategory and second with MODERATE", async () => {
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    const calls = mockCreateAssessment.mock.calls;
    expect(calls[0][0].riskCategory).toBe("LOW");
    expect(calls[1][0].riskCategory).toBe("MODERATE");
  });

  it("seeds with correct modelConfidence values", async () => {
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    const calls = mockCreateAssessment.mock.calls;
    expect(calls[0][0].modelConfidence).toBeCloseTo(0.877);
    expect(calls[1][0].modelConfidence).toBeCloseTo(0.513);
  });

  it("seeds with correct factors array structure", async () => {
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    const firstCall = mockCreateAssessment.mock.calls[0][0];
    expect(Array.isArray(firstCall.factors)).toBe(true);
    expect(firstCall.factors.length).toBeGreaterThan(0);
    expect(firstCall.factors[0]).toHaveProperty("name");
    expect(firstCall.factors[0]).toHaveProperty("impact");
    expect(firstCall.factors[0]).toHaveProperty("description");
  });

  it("returns early when storage.getAssessments returns array directly", async () => {
    mockGetAssessments.mockResolvedValue([{ id: 2 }]);

    await seedDatabase();

    expect(mockCreateAssessment).not.toHaveBeenCalled();
  });

  it("seeds when storage.getAssessments returns empty array directly", async () => {
    mockGetAssessments.mockResolvedValue([]);

    await seedDatabase();

    expect(mockCreateAssessment).toHaveBeenCalledTimes(2);
  });

  it("logs 'Seeding database...' and 'Seeding complete!' messages", async () => {
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    expect(mockLoggerInfo).toHaveBeenCalledWith("Seeding database with sample assessments...");
    expect(mockLoggerInfo).toHaveBeenCalledWith("Seeding complete!");
  });
});
