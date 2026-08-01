import { getDb } from "../db";
import { wearableDevices, wearableMetrics, type WearableDevice, type InsertWearableDevice, type WearableMetric, type InsertWearableMetric } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export class WearableRepository {
  async getDevice(patientId: string, deviceType: string): Promise<WearableDevice | undefined> {
    const db = getDb();
    const result = await db
      .select()
      .from(wearableDevices)
      .where(and(eq(wearableDevices.patientId, patientId), eq(wearableDevices.deviceType, deviceType)))
      .limit(1);
    return result[0];
  }

  async getDevicesForPatient(patientId: string): Promise<WearableDevice[]> {
    const db = getDb();
    return await db
      .select()
      .from(wearableDevices)
      .where(eq(wearableDevices.patientId, patientId));
  }

  async upsertDevice(data: InsertWearableDevice): Promise<WearableDevice> {
    const db = getDb();
    const existing = await this.getDevice(data.patientId, data.deviceType);
    if (existing) {
      const result = await db
        .update(wearableDevices)
        .set({
          ...data,
          lastSyncAt: new Date(),
        })
        .where(eq(wearableDevices.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db
        .insert(wearableDevices)
        .values({
          ...data,
          lastSyncAt: new Date(),
        })
        .returning();
      return result[0];
    }
  }

  async getMetrics(patientId: string, limit = 30): Promise<WearableMetric[]> {
    const db = getDb();
    return await db
      .select()
      .from(wearableMetrics)
      .where(eq(wearableMetrics.patientId, patientId))
      .orderBy(desc(wearableMetrics.date))
      .limit(limit);
  }

  async insertMetrics(data: InsertWearableMetric[]): Promise<WearableMetric[]> {
    if (data.length === 0) return [];
    const db = getDb();
    return await db.insert(wearableMetrics).values(data).returning();
  }
}
