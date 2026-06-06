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
      const createdByCol = (assessments as any).createdBy ?? (assessments as any).created_by;
      if (createdByCol) {
        filters.push(eq(createdByCol, createdBy));
      }
    }

    let countQuery = db.select({ count: sql<number>`count(*)` }).from(assessments);
    if (filters.length > 0) countQuery = countQuery.where(and(...filters)) as any;
    const countResult = await countQuery;
    const totalPatients = Number(countResult[0]?.count || 0);

    let distQuery = db.select({ 
      riskCategory: (assessments as any).riskCategory ?? (assessments as any).risk_category, 
      count: sql<number>`count(*)` 
    }).from(assessments).groupBy((assessments as any).riskCategory ?? (assessments as any).risk_category);
    if (filters.length > 0) distQuery = distQuery.where(and(...filters)) as any;
    const distResult = await distQuery;

    let avgQuery = db.select({ 
      avgBmi: sql<number>`avg(${assessments.bmi})`, 
      avgHba1c: sql<number>`avg(${(assessments as any).hba1cLevel ?? (assessments as any).hba1c_level})` 
    }).from(assessments);
    if (filters.length > 0) avgQuery = avgQuery.where(and(...filters)) as any;
    const avgResult = await avgQuery;

    const riskScoreCol = (assessments as any).riskScore ?? (assessments as any).risk_score;
    let alertsQuery = db.select().from(assessments).orderBy(desc(riskScoreCol)).limit(5);
    if (filters.length > 0) alertsQuery = alertsQuery.where(and(...filters)) as any;
    const alerts = await alertsQuery;

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
