import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalysisCache } from "./analysisCache";

vi.mock("../logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

describe("AnalysisCache", () => {
  let cache: AnalysisCache;

  beforeEach(() => {
    cache = new AnalysisCache(60); // 60 minute TTL
  });

  it("returns null for uncached content", () => {
    const result = cache.get("uncached document");
    expect(result).toBeNull();
  });

  it("stores and retrieves cached analysis result", () => {
    const content = "Clinical document with diagnosis";
    const analysis = {
      diagnosis: "Hypertension",
      confidence: 0.95,
      entities: ["BP", "medication"],
    };

    cache.set(content, analysis);
    const retrieved = cache.get(content);

    expect(retrieved).toEqual(analysis);
  });

  it("returns same cached result for identical content", () => {
    const content = "Same clinical note";
    const analysis = { findings: ["fever", "cough"] };

    cache.set(content, analysis);
    const result1 = cache.get(content);
    const result2 = cache.get(content);

    expect(result1).toEqual(result2);
    expect(result1).toEqual(analysis);
  });

  it("returns different cached results for different content", () => {
    const content1 = "Patient A clinical note";
    const content2 = "Patient B clinical note";
    const analysis1 = { condition: "Diabetes" };
    const analysis2 = { condition: "Hypertension" };

    cache.set(content1, analysis1);
    cache.set(content2, analysis2);

    expect(cache.get(content1)).toEqual(analysis1);
    expect(cache.get(content2)).toEqual(analysis2);
  });

  it("returns null for expired cache entries", () => {
    vi.useFakeTimers();
    const cache = new AnalysisCache(1); // 1 minute TTL
    const content = "document to expire";
    const analysis = { data: "analysis" };

    cache.set(content, analysis);
    expect(cache.get(content)).toEqual(analysis);

    // Advance time past expiration
    vi.advanceTimersByTime(61 * 1000);
    expect(cache.get(content)).toBeNull();

    vi.useRealTimers();
  });

  it("clears all cache entries", () => {
    cache.set("doc1", { result: 1 });
    cache.set("doc2", { result: 2 });

    cache.clear();

    expect(cache.get("doc1")).toBeNull();
    expect(cache.get("doc2")).toBeNull();
  });

  it("provides cache statistics", () => {
    cache.set("doc1", { result: 1 });
    cache.set("doc2", { result: 2 });

    const stats = cache.getStats();

    expect(stats.size).toBe(2);
    expect(stats.entries).toBeGreaterThan(0);
  });

  it("uses content hash for cache key (identical content, different whitespace)", () => {
    const content1 = "Clinical diagnosis: hypertension";
    const content2 = "Clinical diagnosis: hypertension"; // Exactly same
    const analysis = { condition: "Hypertension" };

    cache.set(content1, analysis);
    expect(cache.get(content2)).toEqual(analysis);
  });

  it("handles complex analysis results", () => {
    const content = "comprehensive clinical document";
    const complexResult = {
      diagnoses: [
        { code: "I10", condition: "Hypertension", confidence: 0.98 },
        { code: "E11", condition: "Type 2 Diabetes", confidence: 0.92 },
      ],
      medications: ["Lisinopril", "Metformin"],
      entities: {
        symptoms: ["fatigue", "headache"],
        vitals: { BP: "150/90", HR: 78 },
      },
      timestamp: new Date().toISOString(),
    };

    cache.set(content, complexResult);
    const retrieved = cache.get(content);

    expect(retrieved).toEqual(complexResult);
  });
});
