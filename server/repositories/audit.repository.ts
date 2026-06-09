import { getDb } from "../db";
import { desc, sql } from "drizzle-orm";
import { loginAuditLogs } from "@shared/schema";

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
}
