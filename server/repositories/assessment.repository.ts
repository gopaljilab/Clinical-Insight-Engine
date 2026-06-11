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
        const binaryGenderFilter = or(eq(assessments.gender, "Male"), eq(assessments.gender, "Female"));
        if (binaryGenderFilter) {
          filters.push(not(binaryGenderFilter));
        }
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
          ilike(assessments.riskCategory, pattern),
          ilike(assessments.patientName, pattern)
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
    limit: number = 20,
    offset: number = 0
  ): Promise<{ data: Assessment[]; total: number }> {
    const db = getDb();
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(assessments)
      .where(eq(assessments.patientName, patientName));
    const total = Number(countResult?.count ?? 0);
    const data = await db
      .select()
      .from(assessments)
      .where(eq(assessments.patientName, patientName))
      .orderBy(desc(assessments.createdAt))
      .limit(limit)
      .offset(offset);
    return { data, total };
  }

  async getPatientTrends(patientName: string): Promise<{ date: string; riskScore: number; riskCategory: string }[]> {
    const db = getDb();
    const rows = await db
      .select({
        date: assessments.createdAt,
        riskScore: assessments.riskScore,
        riskCategory: assessments.riskCategory,
      })
      .from(assessments)
      .where(eq(assessments.patientName, patientName))
      .orderBy(asc(assessments.createdAt));
    return rows.map((r) => ({
      date: r.date?.toISOString() ?? "",
      riskScore: r.riskScore,
      riskCategory: r.riskCategory,
    }));
  }

  async deleteAssessment(id: number): Promise<void> {
    const db = getDb();
    await db.delete(assessments).where(eq(assessments.id, id));
  }
}
