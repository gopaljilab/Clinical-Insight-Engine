import { getDb } from "../db";
import { and, desc, eq, ilike, or, lt } from "drizzle-orm";
import { assessments, type Assessment } from "@shared/schema";
import type { RiskCategory } from "../validation/searchValidation";
import type { AssessmentCreateInput } from "../storage";

export class AssessmentRepository {
  async getAssessments(
    limit: number = 20,
    cursor?: number,
    createdBy?: string
  ): Promise<{ data: Assessment[]; nextCursor: number | null }> {
    const db = getDb();
    const filters: ReturnType<typeof eq>[] = [];

    if (createdBy) {
      filters.push(eq(assessments.createdBy, createdBy));
    }
    if (cursor !== undefined) {
      filters.push(lt(assessments.id, cursor) as any);
    }

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
      })
      .from(assessments)
      .orderBy(desc(assessments.id))
      .$dynamic();

    let data: Assessment[];
    const selectQuery = query.limit(limit + 1);
    if (filters.length > 0) {
      data = await selectQuery.where(and(...filters));
    } else {
      data = await selectQuery;
    }

    const hasNext = data.length > limit;
    const pagedData = hasNext ? data.slice(0, limit) : data;
    const nextCursor = hasNext && pagedData.length > 0 ? pagedData[pagedData.length - 1].id : null;

    return { data: pagedData, nextCursor };
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
}
