import { getDb } from "../db";
import { and, desc, eq, sql } from "drizzle-orm";
import { assessments, users } from "@shared/schema";

export class AnalyticsRepository {
  async getSystemStats(): Promise<{
    totalUsers: number;
    totalAssessments: number;
    riskDistribution: { category: string; count: number }[];
  }> {
    const db = getDb();
    const [{ count: userCount }] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [{ count: assessmentCount }] = await db.select({ count: sql<number>`count(*)` }).from(assessments);
    const riskDistributionRaw = await db
      .select({ category: assessments.riskCategory, count: sql<number>`count(*)` })
      .from(assessments)
      .groupBy(assessments.riskCategory);
    return {
      totalUsers: Number(userCount),
      totalAssessments: Number(assessmentCount),
      riskDistribution: riskDistributionRaw,
    };
  }

  async getAnalyticsStats(createdBy?: string) {
    const db = getDb();
    const filters: ReturnType<typeof eq>[] = [];
    if (createdBy) {
      filters.push(eq(assessments.createdBy, createdBy));
    }

    const baseCount = db.select({ count: sql<number>`count(*)` }).from(assessments);
    const countResult = await (filters.length > 0 ? baseCount.where(and(...filters)) : baseCount);
    const totalPatients = Number(countResult[0]?.count || 0);

    const baseDist = db.select({ 
      riskCategory: assessments.riskCategory, 
      count: sql<number>`count(*)` 
    }).from(assessments).groupBy(assessments.riskCategory);
    const distResult = await (filters.length > 0 ? baseDist.where(and(...filters)) : baseDist);

    const baseAvg = db.select({ 
      avgBmi: sql<number>`avg(${assessments.bmi})`, 
      avgHba1c: sql<number>`avg(${assessments.hba1cLevel})` 
    }).from(assessments);
    const avgResult = await (filters.length > 0 ? baseAvg.where(and(...filters)) : baseAvg);

    const baseAlerts = db.select().from(assessments).orderBy(desc(assessments.riskScore)).limit(5);
    const alerts = await (filters.length > 0 ? baseAlerts.where(and(...filters)) : baseAlerts);

    return {
      totalPatients,
      distribution: distResult.map((r: any) => ({ category: r.riskCategory, count: Number(r.count) })),
      averages: {
        bmi: Number(avgResult[0]?.avgBmi || 0),
        hba1c: Number(avgResult[0]?.avgHba1c || 0)
      },
      criticalAlerts: alerts
    };
  }
}
