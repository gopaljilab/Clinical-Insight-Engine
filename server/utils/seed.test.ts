import { describe, expect, it, vi, beforeEach } from "vitest";
import { seedDatabase } from "./seed";

const { mockGetAssessments, mockCreateAssessment, mockLoggerInfo } = vi.hoisted(() => ({
  mockGetAssessments: vi.fn(),
  mockCreateAssessment: vi.fn(),
  mockLoggerInfo: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getAssessments: mockGetAssessments,
    createAssessment: mockCreateAssessment,
  },
}));

vi.mock("../logger", () => ({
  logger: {
    info: mockLoggerInfo,
  },
}));

describe("seedDatabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips seeding when assessments already exist", async () => {
    mockGetAssessments.mockResolvedValue({ data: [{ id: 1 }] });

    await seedDatabase();

    expect(mockCreateAssessment).not.toHaveBeenCalled();
    expect(mockGetAssessments).toHaveBeenCalledWith(1);
  });

  it("seeds when storage returns { data: [] } (empty object)", async () => {
    // { data: [] } means no existing records, seed should run
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    expect(mockCreateAssessment).toHaveBeenCalledTimes(2);
  });

  it("seeds when storage returns null (falls back to empty)", async () => {
    // null: .data is undefined, Array.isArray(null) is false, so existingData = []
    mockGetAssessments.mockResolvedValue(null);
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    expect(mockCreateAssessment).toHaveBeenCalledTimes(2);
  });

  it("creates two seed assessments when no assessments exist", async () => {
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    expect(mockCreateAssessment).toHaveBeenCalledTimes(2);
    expect(mockGetAssessments).toHaveBeenCalledWith(1);
  });

  it("creates seed assessments with correct properties", async () => {
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    const firstCall = mockCreateAssessment.mock.calls[0][0];
    expect(firstCall.patientName).toBe("John Doe");
    expect(firstCall.gender).toBe("Male");
    expect(firstCall.riskCategory).toBe("LOW");
    expect(firstCall.confidenceInterval).toBe("8.5% - 16.1%");
    expect(firstCall.modelConfidence).toBeCloseTo(0.877);

    const secondCall = mockCreateAssessment.mock.calls[1][0];
    expect(secondCall.patientName).toBe("Mary Johnson");
    expect(secondCall.gender).toBe("Female");
    expect(secondCall.riskCategory).toBe("MODERATE");
  });

  it("logs seeding start and completion messages", async () => {
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    expect(mockLoggerInfo).toHaveBeenCalledWith("Seeding database with sample assessments...");
    expect(mockLoggerInfo).toHaveBeenCalledWith("Seeding complete!");
  });

  it("seeds with the correct seed user email", async () => {
    mockGetAssessments.mockResolvedValue({ data: [] });
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    const firstCall = mockCreateAssessment.mock.calls[0][0];
    expect(firstCall.createdBy).toBe("seed@clinical-insight-engine.dev");
  });

  it("seeds when storage returns plain empty array", async () => {
    // Plain []: existingData = [] (Array.isArray is true, but .data is undefined so falls through to [])
    mockGetAssessments.mockResolvedValue([]);
    mockCreateAssessment.mockResolvedValue({ id: 1 });

    await seedDatabase();

    expect(mockCreateAssessment).toHaveBeenCalledTimes(2);
  });
});
