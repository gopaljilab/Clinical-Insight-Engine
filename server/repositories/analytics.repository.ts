import { getDb } from "../db";
import { and, desc, eq, sql, gte, lte } from "drizzle-orm";
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

  async getAnalyticsStats(createdBy?: string, cohortFilters?: any) {
    const db = getDb();
    const filters: any[] = [];
    if (createdBy) {
      filters.push(eq(assessments.createdBy, createdBy));
    }

    if (cohortFilters) {
      if (cohortFilters.gender && cohortFilters.gender !== "All") {
        filters.push(eq(assessments.gender, cohortFilters.gender));
      }
      if (cohortFilters.ageMin !== undefined) {
        filters.push(gte(assessments.age, cohortFilters.ageMin));
      }
      if (cohortFilters.ageMax !== undefined) {
        filters.push(lte(assessments.age, cohortFilters.ageMax));
      }
      if (cohortFilters.riskCategory && cohortFilters.riskCategory !== "All") {
        filters.push(eq(assessments.riskCategory, cohortFilters.riskCategory));
      }
      if (cohortFilters.bmiMin !== undefined) {
        filters.push(gte(assessments.bmi, cohortFilters.bmiMin));
      }
      if (cohortFilters.bmiMax !== undefined) {
        filters.push(lte(assessments.bmi, cohortFilters.bmiMax));
      }
      if (cohortFilters.hba1cMin !== undefined) {
        filters.push(gte(assessments.hba1cLevel, cohortFilters.hba1cMin));
      }
      if (cohortFilters.hba1cMax !== undefined) {
        filters.push(lte(assessments.hba1cLevel, cohortFilters.hba1cMax));
      }
      if (cohortFilters.glucoseMin !== undefined) {
        filters.push(gte(assessments.bloodGlucoseLevel, cohortFilters.glucoseMin));
      }
      if (cohortFilters.glucoseMax !== undefined) {
        filters.push(lte(assessments.bloodGlucoseLevel, cohortFilters.glucoseMax));
      }
      if (cohortFilters.hypertension !== undefined) {
        filters.push(eq(assessments.hypertension, cohortFilters.hypertension));
      }
      if (cohortFilters.heartDisease !== undefined) {
        filters.push(eq(assessments.heartDisease, cohortFilters.heartDisease));
      }
      if (cohortFilters.smokingHistory && cohortFilters.smokingHistory !== "All") {
        filters.push(eq(assessments.smokingHistory, cohortFilters.smokingHistory));
      }
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const baseCount = db.select({ count: sql<number>`count(*)` }).from(assessments);
    const countResult = await (where ? baseCount.where(where) : baseCount);
    const totalPatients = Number(countResult[0]?.count || 0);

    const baseDist = db.select({ 
      riskCategory: assessments.riskCategory, 
      count: sql<number>`count(*)` 
    }).from(assessments).groupBy(assessments.riskCategory);
    const distResult = await (where ? baseDist.where(where) : baseDist);

    const baseAvg = db.select({ 
      avgBmi: sql<number>`avg(${assessments.bmi})`, 
      avgHba1c: sql<number>`avg(${assessments.hba1cLevel})`,
      avgGlucose: sql<number>`avg(${assessments.bloodGlucoseLevel})`,
      avgRiskScore: sql<number>`avg(${assessments.riskScore})`
    }).from(assessments);
    const avgResult = await (where ? baseAvg.where(where) : baseAvg);

    const baseAlerts = db.select().from(assessments).orderBy(desc(assessments.riskScore)).limit(5);
    const alerts = await (where ? baseAlerts.where(where) : baseAlerts);

    // Common Factors
    let whereClauses: any[] = [];
    if (createdBy) {
      whereClauses.push(sql`${assessments.createdBy} = ${createdBy}`);
    }
    if (cohortFilters) {
      if (cohortFilters.gender && cohortFilters.gender !== "All") {
        whereClauses.push(sql`${assessments.gender} = ${cohortFilters.gender}`);
      }
      if (cohortFilters.ageMin !== undefined) {
        whereClauses.push(sql`${assessments.age} >= ${cohortFilters.ageMin}`);
      }
      if (cohortFilters.ageMax !== undefined) {
        whereClauses.push(sql`${assessments.age} <= ${cohortFilters.ageMax}`);
      }
      if (cohortFilters.riskCategory && cohortFilters.riskCategory !== "All") {
        whereClauses.push(sql`${assessments.riskCategory} = ${cohortFilters.riskCategory}`);
      }
      if (cohortFilters.bmiMin !== undefined) {
        whereClauses.push(sql`${assessments.bmi} >= ${cohortFilters.bmiMin}`);
      }
      if (cohortFilters.bmiMax !== undefined) {
        whereClauses.push(sql`${assessments.bmi} <= ${cohortFilters.bmiMax}`);
      }
      if (cohortFilters.hba1cMin !== undefined) {
        whereClauses.push(sql`${assessments.hba1cLevel} >= ${cohortFilters.hba1cMin}`);
      }
      if (cohortFilters.hba1cMax !== undefined) {
        whereClauses.push(sql`${assessments.hba1cLevel} <= ${cohortFilters.hba1cMax}`);
      }
      if (cohortFilters.glucoseMin !== undefined) {
        whereClauses.push(sql`${assessments.bloodGlucoseLevel} >= ${cohortFilters.glucoseMin}`);
      }
      if (cohortFilters.glucoseMax !== undefined) {
        whereClauses.push(sql`${assessments.bloodGlucoseLevel} <= ${cohortFilters.glucoseMax}`);
      }
      if (cohortFilters.hypertension !== undefined) {
        whereClauses.push(sql`${assessments.hypertension} = ${cohortFilters.hypertension}`);
      }
      if (cohortFilters.heartDisease !== undefined) {
        whereClauses.push(sql`${assessments.heartDisease} = ${cohortFilters.heartDisease}`);
      }
      if (cohortFilters.smokingHistory && cohortFilters.smokingHistory !== "All") {
        whereClauses.push(sql`${assessments.smokingHistory} = ${cohortFilters.smokingHistory}`);
      }
    }

    let whereSql = sql``;
    if (whereClauses.length > 0) {
      whereSql = sql`WHERE ${sql.join(whereClauses, sql` AND `)}`;
    }

    const factorsSql = sql`
      SELECT 
        f->>'name' as factor, 
        COUNT(*)::int as count
      FROM ${assessments}, jsonb_array_elements(${assessments.factors}) f
      ${whereSql}
      GROUP BY f->>'name'
      ORDER BY count DESC
      LIMIT 10
    `;
    const factorsResult = await db.execute(factorsSql);

    // Demographics by Gender
    const genderDistQuery = db.select({
      gender: assessments.gender,
      riskCategory: assessments.riskCategory,
      count: sql<number>`count(*)::int`
    }).from(assessments).groupBy(assessments.gender, assessments.riskCategory);
    const genderDistResult = await (where ? genderDistQuery.where(where) : genderDistQuery);

    // Demographics by Age Group
    const ageGroupSql = sql<string>`
      CASE 
        WHEN ${assessments.age} < 40 THEN '< 40'
        WHEN ${assessments.age} BETWEEN 40 AND 60 THEN '40-60'
        ELSE '> 60'
      END
    `;
    const ageDistQuery = db.select({
      ageGroup: ageGroupSql,
      riskCategory: assessments.riskCategory,
      count: sql<number>`count(*)::int`
    }).from(assessments).groupBy(ageGroupSql, assessments.riskCategory);
    const ageDistResult = await (where ? ageDistQuery.where(where) : ageDistQuery);

    return {
      totalPatients,
      distribution: distResult.map((r: any) => ({ category: r.riskCategory, count: Number(r.count) })),
      averages: {
        bmi: Number(avgResult[0]?.avgBmi || 0),
        hba1c: Number(avgResult[0]?.avgHba1c || 0),
        glucose: Number(avgResult[0]?.avgGlucose || 0),
        riskScore: Number(avgResult[0]?.avgRiskScore || 0)
      },
      criticalAlerts: alerts,
      commonFactors: factorsResult.rows.map((r: any) => ({ factor: r.factor, count: Number(r.count) })),
      demographics: {
        gender: genderDistResult.map((r: any) => ({ gender: r.gender, riskCategory: r.riskCategory, count: Number(r.count) })),
        age: ageDistResult.map((r: any) => ({ ageGroup: r.ageGroup, riskCategory: r.riskCategory, count: Number(r.count) }))
      }
    };
  }
}
