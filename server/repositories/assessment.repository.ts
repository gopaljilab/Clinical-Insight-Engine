import { getDb } from "../db";
import { and, desc, eq, ilike, or, lt, asc, sql, gte, lte, ne, not } from "drizzle-orm";
import { assessments, type Assessment } from "@shared/schema";
import type { RiskCategory } from "../validation/searchValidation";
import type { AssessmentCreateInput } from "../storage";

export class AssessmentRepository {
  async getAssessments(
    limitOrParams?: number | {
      limit?: number;
      page?: number;
      cursor?: number;
      createdBy?: string;
      sortBy?: string;
      order?: "asc" | "desc";
      searchTerm?: string;
      riskCategory?: string;
      gender?: string;
      minAge?: number;
      maxAge?: number;
      startDate?: string;
      endDate?: string;
    },
    cursor?: number,
    createdBy?: string
  ): Promise<{
    data: Assessment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    nextCursor: number | null;
  }> {
    const db = getDb();
    
    let limit = 20;
    let page = 1;
    let sortBy = "createdAt";
    let order: "asc" | "desc" = "desc";
    let searchTerm: string | undefined;
    let riskCategory: string | undefined;
    let gender: string | undefined;
    let minAge: number | undefined;
    let maxAge: number | undefined;
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (typeof limitOrParams === "object" && limitOrParams !== null) {
      limit = limitOrParams.limit ?? 20;
      page = limitOrParams.page ?? 1;
      createdBy = limitOrParams.createdBy;
      sortBy = limitOrParams.sortBy ?? "createdAt";
      order = limitOrParams.order ?? "desc";
      searchTerm = limitOrParams.searchTerm;
      riskCategory = limitOrParams.riskCategory;
      gender = limitOrParams.gender;
      minAge = limitOrParams.minAge;
      maxAge = limitOrParams.maxAge;
      startDate = limitOrParams.startDate;
      endDate = limitOrParams.endDate;
      cursor = limitOrParams.cursor;
    } else {
      limit = limitOrParams ?? 20;
    }

    const filters: any[] = [];

    if (createdBy) {
      filters.push(eq(assessments.createdBy, createdBy));
    }

    if (gender && gender !== "All") {
      if (gender === "Other") {
        filters.push(and(
          not(eq(assessments.gender, "Male")),
          not(eq(assessments.gender, "Female"))
        ));
      } else {
        filters.push(eq(assessments.gender, gender));
      }
    }

    if (riskCategory && riskCategory !== "All") {
      filters.push(eq(assessments.riskCategory, riskCategory.toUpperCase()));
    }

    if (minAge !== undefined) {
      filters.push(gte(assessments.age, minAge));
    }

    if (maxAge !== undefined) {
      filters.push(lte(assessments.age, maxAge));
    }

    if (startDate && !isNaN(Date.parse(startDate))) {
      filters.push(gte(assessments.createdAt, new Date(startDate)));
    }

    if (endDate && !isNaN(Date.parse(endDate))) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filters.push(lte(assessments.createdAt, end));
    }

    if (searchTerm && searchTerm.trim() !== "") {
      const pattern = `%${searchTerm.trim()}%`;
      filters.push(
        or(
          ilike(assessments.patientName, pattern),
          ilike(assessments.gender, pattern),
          ilike(assessments.riskCategory, pattern),
          ilike(assessments.smokingHistory, pattern)
        )
      );
    }

    // 1. Get total matching count
    let countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(assessments);

    if (filters.length > 0) {
      countQuery = countQuery.where(and(...filters)) as any;
    }

    const countResult = await countQuery;
    const total = Number(countResult[0]?.count ?? 0);

    // 2. Fetch data page
    let orderFn = order === "asc" ? asc : desc;
    let orderByClause: any;

    switch (sortBy) {
      case "date":
      case "createdAt":
        orderByClause = orderFn(assessments.createdAt);
        break;
      case "risk":
      case "riskScore":
        orderByClause = orderFn(assessments.riskScore);
        break;
      case "age":
        orderByClause = orderFn(assessments.age);
        break;
      case "bmi":
        orderByClause = orderFn(assessments.bmi);
        break;
      case "patientName":
        orderByClause = orderFn(assessments.patientName);
        break;
      case "gender":
        orderByClause = orderFn(assessments.gender);
        break;
      default:
        orderByClause = desc(assessments.id);
        break;
    }

    const totalPages = Math.ceil(total / limit);

    // Handle cursor pagination fallback if cursor is explicitly passed
    if (cursor !== undefined) {
      const cursorFilters = [...filters];
      cursorFilters.push(lt(assessments.id, cursor) as any);

      let query = db
        .select({
          id: assessments.id,
          patientName: assessments.patientName,
          gender: assessments.gender,
          age: assessments.age,
          hypertension: assessments.hypertension,
          heartDisease: assessments.heartDisease,
          smokingHistory: assessments.smokingHistory,
          bmi: assessments.bmi,
          hba1cLevel: assessments.hba1cLevel,
          bloodGlucoseLevel: assessments.bloodGlucoseLevel,
          riskScore: assessments.riskScore,
          riskCategory: assessments.riskCategory,
          factors: assessments.factors,
          confidenceInterval: (assessments as any).confidenceInterval ?? (assessments as any).confidence_interval,
          modelConfidence: (assessments as any).modelConfidence ?? (assessments as any).model_confidence,
          createdAt: (assessments as any).createdAt ?? (assessments as any).created_at,
          createdBy: (assessments as any).createdBy ?? (assessments as any).created_by,
          userId: (assessments as any).userId ?? (assessments as any).user_id,
          ownerId: assessments.ownerId,
          clinicalNote: assessments.clinicalNote,
          explainableInsights: assessments.explainableInsights,
        })
        .from(assessments)
        .orderBy(desc(assessments.id))
        .$dynamic();

      const selectQuery = query.limit(limit + 1);
      const data = await selectQuery.where(and(...cursorFilters));

      const hasNext = data.length > limit;
      const pagedData = hasNext ? data.slice(0, limit) : data;
      const nextCursor = hasNext && pagedData.length > 0 ? pagedData[pagedData.length - 1].id : null;

      return {
        data: pagedData,
        total,
        page: 1,
        limit,
        totalPages,
        nextCursor
      };
    }

    const offset = (page - 1) * limit;

    let query = db
      .select({
        id: assessments.id,
        patientName: assessments.patientName,
        gender: assessments.gender,
        age: assessments.age,
        hypertension: assessments.hypertension,
        heartDisease: assessments.heartDisease,
        smokingHistory: assessments.smokingHistory,
        bmi: assessments.bmi,
        hba1cLevel: assessments.hba1cLevel,
        bloodGlucoseLevel: assessments.bloodGlucoseLevel,
        riskScore: assessments.riskScore,
        riskCategory: assessments.riskCategory,
        factors: assessments.factors,
        confidenceInterval: (assessments as any).confidenceInterval ?? (assessments as any).confidence_interval,
        modelConfidence: (assessments as any).modelConfidence ?? (assessments as any).model_confidence,
        createdAt: (assessments as any).createdAt ?? (assessments as any).created_at,
        createdBy: (assessments as any).createdBy ?? (assessments as any).created_by,
        userId: (assessments as any).userId ?? (assessments as any).user_id,
        ownerId: assessments.ownerId,
        clinicalNote: assessments.clinicalNote,
        explainableInsights: assessments.explainableInsights,
      })
      .from(assessments)
      .orderBy(orderByClause, desc(assessments.id))
      .$dynamic();

    if (filters.length > 0) {
      query = query.where(and(...filters)) as any;
    }

    const data = await query.limit(limit).offset(offset);
    const hasNext = page < totalPages;
    const nextCursor = hasNext && data.length > 0 ? data[data.length - 1].id : null;

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      nextCursor
    };
  }

  async searchAssessments(
    searchTerm: string,
    createdBy?: string,
    riskCategory?: RiskCategory,
    limit: number = 20,
    cursor?: number
  ): Promise<{ data: Assessment[]; nextCursor: number | null }> {
    const db = getDb();
    const conditions: ReturnType<typeof eq>[] = [];

    if (createdBy) {
      conditions.push(eq(assessments.createdBy, createdBy));
    }
    if (riskCategory) {
      conditions.push(eq(assessments.riskCategory, riskCategory));
    }
    if (cursor !== undefined) {
      conditions.push(lt(assessments.id, cursor) as any);
    }

    if (searchTerm && searchTerm.trim() !== "") {
      const pattern = `%${searchTerm.trim()}%`;
      conditions.push(
        or(
          ilike(assessments.patientName, pattern),
          ilike(assessments.gender, pattern),
          ilike(assessments.smokingHistory, pattern),
          ilike(assessments.riskCategory, pattern)
        ) as ReturnType<typeof eq>
      );
    }

    let query = db
      .select()
      .from(assessments)
      .orderBy(desc(assessments.id))
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const data = await query.limit(limit + 1);
    const hasNext = data.length > limit;
    const pagedData = hasNext ? data.slice(0, limit) : data;
    const nextCursor = hasNext && pagedData.length > 0 ? pagedData[pagedData.length - 1].id : null;

    return { data: pagedData, nextCursor };
  }

  async getAssessmentById(id: number): Promise<Assessment | undefined> {
    const db = getDb();
    const conditions: ReturnType<typeof eq>[] = [eq(assessments.id, id)];

    const [result] = await db
      .select()
      .from(assessments)
      .where(and(...conditions))
      .limit(1);

    return result;
  }

  async createAssessment(assessment: AssessmentCreateInput): Promise<Assessment> {
    const db = getDb();
    const [created] = await db
      .insert(assessments)
      .values(assessment as any)
      .returning();
    return created;
  }

  async autocompletePatientNames(
    query: string,
    createdBy?: string,
    limit: number = 10
  ): Promise<string[]> {
    const db = getDb();
    const conditions: ReturnType<typeof eq>[] = [];

    if (createdBy) {
      conditions.push(eq(assessments.createdBy, createdBy));
    }

    let queryBuilder = db
      .select({ patientName: assessments.patientName })
      .from(assessments)
      .where(
        and(
          ilike(assessments.patientName, `%${query}%`),
          ...conditions
        ) as any
      )
      .$dynamic();

    const rows = await queryBuilder
      .groupBy(assessments.patientName)
      .orderBy(assessments.patientName)
      .limit(limit);

    return rows.map((r) => r.patientName).filter(Boolean) as string[];
  }

  async getAssessmentsByPatientName(
    patientName: string,
    limit: number = 100,
    offset: number = 0,
    createdBy?: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ data: Assessment[]; total: number }> {
    const db = getDb();
    const filters: any[] = [eq(assessments.patientName, patientName)];
    if (createdBy) {
      filters.push(eq(assessments.createdBy, createdBy));
    }
    if (startDate && !isNaN(Date.parse(startDate))) {
      filters.push(gte(assessments.createdAt, new Date(startDate)));
    }
    if (endDate && !isNaN(Date.parse(endDate))) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filters.push(lte(assessments.createdAt, end));
    }
    const where = and(...filters);
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(assessments)
      .where(where);
    const total = Number(countResult?.count ?? 0);
    const data = await db
      .select()
      .from(assessments)
      .where(where)
      .orderBy(desc(assessments.createdAt))
      .limit(limit)
      .offset(offset);
    return { data, total };
  }

  async getPatientTrends(patientName: string, createdBy?: string): Promise<{ date: string; riskScore: number; riskCategory: string }[]> {
    const db = getDb();
    const conditions: ReturnType<typeof eq>[] = [eq(assessments.patientName, patientName)];
    if (createdBy) {
      conditions.push(eq(assessments.createdBy, createdBy));
    }
    const rows = await db
      .select({
        date: assessments.createdAt,
        riskScore: assessments.riskScore,
        riskCategory: assessments.riskCategory,
      })
      .from(assessments)
      .where(and(...conditions))
      .orderBy(asc(assessments.createdAt));
    return rows.map((r) => ({
      date: r.date?.toISOString() ?? "",
      riskScore: r.riskScore,
      riskCategory: r.riskCategory,
    }));
  }

  async getTrendsDashboardData(patientName: string, startDate?: string, endDate?: string) {
    const db = getDb();
    const filters: any[] = [eq(assessments.patientName, patientName)];
    if (startDate && !isNaN(Date.parse(startDate))) filters.push(gte(assessments.createdAt, new Date(startDate)));
    if (endDate && !isNaN(Date.parse(endDate))) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filters.push(lte(assessments.createdAt, end));
    }
    const where = and(...filters);

    const data = await db
      .select()
      .from(assessments)
      .where(where)
      .orderBy(asc(assessments.createdAt));

    const latest = data[data.length - 1];
    const earliest = data.length >= 2 ? data[0] : null;

    let trend: "improving" | "stable" | "worsening" = "stable";
    if (data.length >= 2 && latest && earliest) {
      const diff = latest.riskScore - earliest.riskScore;
      if (diff < -2) trend = "improving";
      else if (diff > 2) trend = "worsening";
    }

    const avgRisk = data.length > 0 ? data.reduce((s, a) => s + a.riskScore, 0) / data.length : 0;

    return {
      assessments: data.map((a) => ({
        id: a.id,
        patientName: a.patientName,
        gender: a.gender,
        age: a.age,
        bmi: a.bmi,
        hba1cLevel: a.hba1cLevel,
        bloodGlucoseLevel: a.bloodGlucoseLevel,
        riskScore: a.riskScore,
        riskCategory: a.riskCategory,
        hypertension: a.hypertension,
        heartDisease: a.heartDisease,
        smokingHistory: a.smokingHistory,
        createdAt: a.createdAt?.toISOString() ?? "",
      })),
      summary: {
        total: data.length,
        latestRiskScore: latest?.riskScore ?? null,
        latestRiskCategory: latest?.riskCategory ?? null,
        earliestRiskScore: earliest?.riskScore ?? null,
        trend,
        avgRiskScore: Number(avgRisk.toFixed(1)),
        change: latest && earliest ? Number((latest.riskScore - earliest.riskScore).toFixed(1)) : 0,
      },
    };
  }

  async createAssessmentsBatch(data: AssessmentCreateInput[]): Promise<Assessment[]> {
    const db = getDb();
    return db.transaction(async (tx) => {
      return tx.insert(assessments).values(data as any).returning();
    });
  }

  async deleteAssessment(id: number): Promise<void> {
    const db = getDb();
    await db.delete(assessments).where(eq(assessments.id, id));
  }

  async getCohortStats(params: {
    minAge?: number; maxAge?: number;
    minBmi?: number; maxBmi?: number;
    minHba1c?: number; maxHba1c?: number;
    minGlucose?: number; maxGlucose?: number;
    gender?: string;
    smokingHistory?: string;
    hypertension?: boolean;
    heartDisease?: boolean;
    riskCategory?: string;
    startDate?: string; endDate?: string;
    createdBy?: string;
  }) {
    const db = getDb();
    const filters: any[] = [];

    if (params.createdBy) filters.push(eq(assessments.createdBy, params.createdBy));
    if (params.gender) filters.push(eq(assessments.gender, params.gender));
    if (params.smokingHistory) filters.push(eq(assessments.smokingHistory, params.smokingHistory));
    if (params.hypertension !== undefined) filters.push(eq(assessments.hypertension, params.hypertension));
    if (params.heartDisease !== undefined) filters.push(eq(assessments.heartDisease, params.heartDisease));
    if (params.riskCategory) filters.push(eq(assessments.riskCategory, params.riskCategory));
    if (params.minAge !== undefined) filters.push(gte(assessments.age, params.minAge));
    if (params.maxAge !== undefined) filters.push(lte(assessments.age, params.maxAge));
    if (params.minBmi !== undefined) filters.push(gte(assessments.bmi, params.minBmi));
    if (params.maxBmi !== undefined) filters.push(lte(assessments.bmi, params.maxBmi));
    if (params.minHba1c !== undefined) filters.push(gte(assessments.hba1cLevel, params.minHba1c));
    if (params.maxHba1c !== undefined) filters.push(lte(assessments.hba1cLevel, params.maxHba1c));
    if (params.minGlucose !== undefined) filters.push(gte(assessments.bloodGlucoseLevel, params.minGlucose));
    if (params.maxGlucose !== undefined) filters.push(lte(assessments.bloodGlucoseLevel, params.maxGlucose));
    if (params.startDate && !isNaN(Date.parse(params.startDate))) filters.push(gte(assessments.createdAt, new Date(params.startDate)));
    if (params.endDate && !isNaN(Date.parse(params.endDate))) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      filters.push(lte(assessments.createdAt, end));
    }

    const where = filters.length > 0 ? and(...filters) : undefined;

    const [agg] = await db
      .select({
        total: sql<number>`count(*)`,
        avgRiskScore: sql<number>`avg(${assessments.riskScore})`,
        avgBmi: sql<number>`avg(${assessments.bmi})`,
        avgHba1c: sql<number>`avg(${assessments.hba1cLevel})`,
        avgGlucose: sql<number>`avg(${assessments.bloodGlucoseLevel})`,
      })
      .from(assessments)
      .where(where);

    const riskDist = await db
      .select({ category: assessments.riskCategory, count: sql<number>`count(*)` })
      .from(assessments)
      .where(where)
      .groupBy(assessments.riskCategory)
      .orderBy(assessments.riskCategory);

    const ageBuckets = `
      CASE
        WHEN ${assessments.age} < 30 THEN 'Under 30'
        WHEN ${assessments.age} BETWEEN 30 AND 39 THEN '30-39'
        WHEN ${assessments.age} BETWEEN 40 AND 49 THEN '40-49'
        WHEN ${assessments.age} BETWEEN 50 AND 59 THEN '50-59'
        WHEN ${assessments.age} BETWEEN 60 AND 69 THEN '60-69'
        ELSE '70+'
      END
    `;

    const ageDist = await db
      .select({ range: sql<string>`${sql.raw(ageBuckets)}`, count: sql<number>`count(*)` })
      .from(assessments)
      .where(where)
      .groupBy(sql.raw(ageBuckets))
      .orderBy(sql.raw(ageBuckets));

    const genderDist = await db
      .select({ gender: assessments.gender, count: sql<number>`count(*)` })
      .from(assessments)
      .where(where)
      .groupBy(assessments.gender)
      .orderBy(assessments.gender);

    const smokingDist = await db
      .select({ status: assessments.smokingHistory, count: sql<number>`count(*)` })
      .from(assessments)
      .where(where)
      .groupBy(assessments.smokingHistory)
      .orderBy(assessments.smokingHistory);

    const [comorbidityResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(assessments)
      .where(where ? and(where, sql`${assessments.hypertension} = true OR ${assessments.heartDisease} = true`) : sql`${assessments.hypertension} = true OR ${assessments.heartDisease} = true`);

    const total = Number(agg?.total ?? 0);
    const comorbidityCount = Number(comorbidityResult?.count ?? 0);

    return {
      total,
      avgRiskScore: agg?.avgRiskScore ?? null,
      avgBmi: agg?.avgBmi ?? null,
      avgHba1c: agg?.avgHba1c ?? null,
      avgGlucose: agg?.avgGlucose ?? null,
      riskDistribution: riskDist.map(r => ({ category: r.category ?? "Unknown", count: Number(r.count) })),
      ageDistribution: ageDist.map(a => ({ range: a.range, count: Number(a.count) })),
      genderDistribution: genderDist.map(g => ({ gender: g.gender ?? "Unknown", count: Number(g.count) })),
      smokingDistribution: smokingDist.map(s => ({ status: s.status ?? "Unknown", count: Number(s.count) })),
      comorbidityRate: total > 0 ? Number((comorbidityCount / total * 100).toFixed(1)) : 0,
    };
  }
}
