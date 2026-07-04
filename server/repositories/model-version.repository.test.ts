import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModelVersionRepository } from "./model-version.repository";
import { desc } from "drizzle-orm";
import { modelVersions } from "@shared/schema";

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("../db", () => ({
  getDb: vi.fn(() => mockDb),
}));

describe("ModelVersionRepository", () => {
  let repo: ModelVersionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ModelVersionRepository();
  });

  describe("findAll", () => {
    it("returns all model versions ordered by desc version", async () => {
      const mockVersions = [
        { id: 2, version: 2, name: "v2", createdAt: new Date() },
        { id: 1, version: 1, name: "v1", createdAt: new Date() },
      ];
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockResolvedValue(mockVersions),
        }),
      });

      const result = await repo.findAll();
      expect(result).toEqual(mockVersions);
      expect(mockDb.select).toHaveBeenCalledWith();
    });
  });

  describe("findLatest", () => {
    it("returns the single most recent version", async () => {
      const latest = { id: 5, version: 5, name: "v5", createdAt: new Date() };
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([latest]),
          }),
        }),
      });

      const result = await repo.findLatest();
      expect(result).toEqual(latest);
    });

    it("returns undefined when no versions exist", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repo.findLatest();
      expect(result).toBeUndefined();
    });
  });

  describe("create", () => {
    it("inserts data and returns the created record", async () => {
      const input = {
        name: "test-model",
        version: 3,
        modelType: "classification",
        accuracy: 0.92,
      };
      const created = { id: 10, ...input, createdAt: new Date() };
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValue([created]),
        }),
      });

      const result = await repo.create(input);
      expect(result).toEqual(created);
      expect(mockDb.insert).toHaveBeenCalledWith(modelVersions);
    });
  });

  describe("getLatestVersionNumber", () => {
    it("returns the highest version number", async () => {
      // drizzle: db.select({...}).from(...).orderBy(...).limit(...)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([{ version: 7 }]),
          }),
        }),
      });

      const result = await repo.getLatestVersionNumber();
      expect(result).toBe(7);
    });

    it("returns 0 when no versions exist", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repo.getLatestVersionNumber();
      expect(result).toBe(0);
    });
  });

  describe("getDatasetStats", () => {
    it("returns null when no latest model exists", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await repo.getDatasetStats();
      expect(result).toBeNull();
    });

    it("returns null when latest model has no classBalance or featureDistributions", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([
              { id: 1, classBalance: null, featureDistributions: null },
            ]),
          }),
        }),
      });

      const result = await repo.getDatasetStats();
      expect(result).toBeNull();
    });

    it("returns classBalance, featureStats, and totalSamples when available", async () => {
      const mockLatest = {
        id: 1,
        classBalance: { cat: 100, dog: 80 },
        featureDistributions: { age: { mean: 45, std: 10 } },
        numSamples: 500,
      };
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          orderBy: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([mockLatest]),
          }),
        }),
      });

      const result = await repo.getDatasetStats();
      expect(result).toEqual({
        classBalance: { cat: 100, dog: 80 },
        featureStats: { age: { mean: 45, std: 10 } },
        totalSamples: 500,
      });
    });
  });
});
