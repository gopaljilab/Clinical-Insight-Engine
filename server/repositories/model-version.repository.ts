import { getDb } from "../db";
import { modelVersions, type ModelVersion, type InsertModelVersion } from "@shared/schema";
import { desc, eq } from "drizzle-orm";

export class ModelVersionRepository {
  async findAll(): Promise<ModelVersion[]> {
    const db = getDb();
    return db.select().from(modelVersions).orderBy(desc(modelVersions.version));
  }

  async findLatest(): Promise<ModelVersion | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(modelVersions)
      .orderBy(desc(modelVersions.version))
      .limit(1);
    return results[0];
  }

  async create(data: InsertModelVersion): Promise<ModelVersion> {
    const db = getDb();
    const results = await db.insert(modelVersions).values(data).returning();
    return results[0];
  }

  async getLatestVersionNumber(): Promise<number> {
    const db = getDb();
    const results = await db
      .select({ version: modelVersions.version })
      .from(modelVersions)
      .orderBy(desc(modelVersions.version))
      .limit(1);
    return results[0]?.version ?? 0;
  }

  async getDatasetStats(): Promise<{ classBalance: Record<string, number>; featureStats: Record<string, { mean: number; std: number }>; totalSamples: number } | null> {
    const latest = await this.findLatest();
    if (!latest?.classBalance && !latest?.featureDistributions) return null;
    return {
      classBalance: (latest.classBalance as Record<string, number>) ?? {},
      featureStats: (latest.featureDistributions as Record<string, { mean: number; std: number }>) ?? {},
      totalSamples: latest.numSamples ?? 0,
    };
  }
}
