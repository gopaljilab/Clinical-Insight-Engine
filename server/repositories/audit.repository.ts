import { getDb } from "../db";
import { desc, sql } from "drizzle-orm";
import { loginAuditLogs, patientAccessAuditLogs } from "@shared/schema";

export class AuditRepository {
  async getLoginAuditLogs(page: number = 1, limit: number = 20): Promise<{ data: typeof loginAuditLogs.$inferSelect[]; total: number }> {
    const db = getDb();
    const offset = (page - 1) * limit;
    const data = await db.select().from(loginAuditLogs).orderBy(desc(loginAuditLogs.createdAt)).limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(loginAuditLogs);
    return { data, total: Number(count) };
  }

  async recordLoginAudit(params: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    loginStatus: string;
  }): Promise<void> {
    const db = getDb();
    await db.insert(loginAuditLogs).values({
      userId: params.userId ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      loginStatus: params.loginStatus,
    });
  }

  async recordPatientAccess(params: {
    userId: string;
    resourceType: string;
    resourceId?: string;
    action: string;
    ipAddress?: string;
    userAgent?: string;
    granted: boolean;
  }): Promise<void> {
    const db = getDb();
    await db.insert(patientAccessAuditLogs).values({
      userId: params.userId,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      action: params.action,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      granted: params.granted,
    });
  }

  async getPatientAccessAuditLogs(page: number = 1, limit: number = 20): Promise<{ data: typeof patientAccessAuditLogs.$inferSelect[]; total: number }> {
    const db = getDb();
    const offset = (page - 1) * limit;
    const data = await db.select().from(patientAccessAuditLogs).orderBy(desc(patientAccessAuditLogs.createdAt)).limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(patientAccessAuditLogs);
    return { data, total: Number(count) };
  }
}
