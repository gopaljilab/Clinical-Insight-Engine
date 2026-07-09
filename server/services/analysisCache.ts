/**
 * analysisCache.ts
 *
 * Caching layer for clinical document analysis results.
 * Prevents redundant LLM API calls for duplicate document content.
 * Improves performance and reduces API costs for repeated analyses.
 */

import { createHash } from "crypto";
import { logger } from "../logger";

export interface CachedAnalysisResult {
  documentHash: string;
  result: any;
  timestamp: number;
  expiresAt: number;
}

/**
 * In-memory cache for document analysis results.
 * Configurable TTL to balance freshness vs. performance.
 */
export class AnalysisCache {
  private cache = new Map<string, CachedAnalysisResult>();
  private readonly defaultTTL: number; // milliseconds

  constructor(ttlMinutes: number = 60) {
    this.defaultTTL = ttlMinutes * 60 * 1000;
  }

  /**
   * Compute content hash for cache key
   */
  private computeHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Get cached analysis result if available and not expired
   */
  get(documentContent: string): any | null {
    const hash = this.computeHash(documentContent);
    const cached = this.cache.get(hash);

    if (!cached) {
      return null;
    }

    // Check if cache entry has expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(hash);
      logger.debug({ hash }, "Removed expired cache entry");
      return null;
    }

    logger.info({ hash }, "Document analysis cache hit");
    return cached.result;
  }

  /**
   * Store analysis result in cache
   */
  set(documentContent: string, result: any): void {
    const hash = this.computeHash(documentContent);
    const now = Date.now();

    this.cache.set(hash, {
      documentHash: hash,
      result,
      timestamp: now,
      expiresAt: now + this.defaultTTL,
    });

    logger.info(
      { hash, resultSize: JSON.stringify(result).length },
      "Cached document analysis result"
    );
  }

  /**
   * Clear cache for testing or manual invalidation
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    logger.info({ size }, "Cleared analysis cache");
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; entries: number } {
    let validEntries = 0;
    for (const cached of this.cache.values()) {
      if (Date.now() <= cached.expiresAt) {
        validEntries++;
      }
    }

    return {
      size: this.cache.size,
      entries: validEntries,
    };
  }
}

// Global cache instance (60 minute TTL)
export const analysisCache = new AnalysisCache(60);
