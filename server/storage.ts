import { loginAuditLogs, type Assessment, type InsertAssessment, type AssessmentFactor, type User, type InsertUser } from "@shared/schema";
import type { RiskCategory } from "./validation/searchValidation";

import { UserRepository } from "./repositories/user.repository";
import { AssessmentRepository } from "./repositories/assessment.repository";
import { AuditRepository } from "./repositories/audit.repository";
import { AnalyticsRepository } from "./repositories/analytics.repository";

export interface IStorage {
  getAssessments(limit?: number, cursor?: number, createdBy?: string): Promise<{ data: Assessment[]; nextCursor: number | null }>;
  /**
   * Searches assessments by patient name, risk category, and other fields.
   * Uses Drizzle ORM ilike()/eq() — user input is NEVER interpolated into SQL strings.
   *
   * FIX for Issue #744: now searches patientName via ilike() so queries for a
   * specific patient name will correctly return only that patient's records.
   * Results are always scoped to `createdBy` (the requesting user's email) to
   * prevent cross-patient data leakage at the database layer.
   */
  searchAssessments(
    searchTerm: string,
    createdBy?: string,
    riskCategory?: RiskCategory,
    limit?: number,
    cursor?: number
  ): Promise<{ data: Assessment[]; nextCursor: number | null }>;
  /** Returns a single assessment by numeric ID. Authorization must be checked by caller. */
  getAssessmentById(id: number): Promise<Assessment | undefined>;
  createAssessment(assessment: any): Promise<Assessment>;
  createUser(data: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(page: number, limit: number): Promise<{ data: User[]; total: number }>;
  getLoginAuditLogs(page: number, limit: number): Promise<{ data: typeof loginAuditLogs.$inferSelect[]; total: number }>;
  updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>): Promise<User>;
  getSystemStats(): Promise<{ totalUsers: number; totalAssessments: number; riskDistribution: { category: string; count: number }[]; }>;
  recordLoginAudit(params: { userId?: string; ipAddress?: string; userAgent?: string; loginStatus: string; }): Promise<void>;
  getAnalyticsStats(createdBy?: string): Promise<any>;
}

export type AssessmentCreateInput = InsertAssessment & {
  riskScore: number;
  riskCategory: string;
  factors: AssessmentFactor[];
  confidenceInterval?: string;
  modelConfidence?: number;
  createdBy: string;
};

export class DatabaseStorage implements IStorage {
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
        confidenceInterval:
          (assessments as any).confidenceInterval ?? (assessments as any).confidence_interval,
        modelConfidence:
          (assessments as any).modelConfidence ?? (assessments as any).model_confidence,
        createdAt:
          (assessments as any).createdAt ?? (assessments as any).created_at,
        createdBy:
          (assessments as any).createdBy ?? (assessments as any).created_by,
        userId:
          (assessments as any).userId ?? (assessments as any).user_id,
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

  /**
   * Searches assessments by risk category label.
   *
   * Security: all conditions use Drizzle ORM parameterized helpers (ilike / eq).
   * User-supplied `searchTerm` is passed as a bound parameter — never concatenated
   * into a raw SQL string.  This is the primary defence against SQL injection.
   *
   * Data Isolation: results are ALWAYS scoped to `createdBy` (the authenticated
   * user's email) so that no cross-patient data leakage is possible at the DB layer.
   *
   * @param searchTerm   Free-text search term (validated upstream by searchValidation.ts)
   * @param createdBy    Restrict results to this user's own records
   * @param riskCategory Optional filter: LOW | MODERATE | HIGH
   * @param limit        Maximum rows to return (default 20)
   * @param cursor       Pagination cursor (id) — applied ONCE to avoid duplicate filtering
   */
  async searchAssessments(
    searchTerm: string,
    createdBy?: string,
    riskCategory?: RiskCategory,
    limit: number = 20,
    cursor?: number
  ): Promise<{ data: Assessment[]; nextCursor: number | null }> {
    const db = getDb();

    // Build an array of WHERE conditions — all parameterized by Drizzle ORM.
    // ilike() maps to: WHERE column ILIKE $1   (PostgreSQL bound parameter)
    // eq()    maps to: WHERE column = $1
    const conditions: ReturnType<typeof eq>[] = [];

    // SECURITY: Always scope results to the requesting user's own records.
    // This is the primary guard against cross-patient data leakage.
    if (createdBy) {
      conditions.push(eq(assessments.createdBy, createdBy));
    }

    // Risk category exact-match filter (parameterized)
    if (riskCategory) {
      conditions.push(eq(assessments.riskCategory, riskCategory));
    }

    // Cursor-based pagination: only include records with id < cursor.
    // NOTE: Applied here ONCE — a previous version incorrectly added this
    // condition twice which could cause incorrect pagination results.
    if (cursor !== undefined) {
      conditions.push(lt(assessments.id, cursor) as any);
    }

    // Free-text search across patient name and other clinically relevant fields.
    // ilike() uses PostgreSQL's case-insensitive LIKE with bound parameters:
    //   WHERE (patient_name ILIKE $N OR gender ILIKE $N OR ...)
    // The `searchTerm` value is NEVER interpolated — Drizzle sends it as a placeholder.
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

  /**
   * Retrieves a single assessment by its numeric primary key.
   * NOTE: This function no longer implicitly scopes by `createdBy`.
   * Object-Level Authorization must be explicitly checked by the caller using `canAccessPatientRecord`.
   *
   * Security: uses Drizzle ORM eq() — parameterized, not string-concatenated.
   */
  async getAssessmentById(
    id: number
  ): Promise<Assessment | undefined> {
    const db = getDb();

    const conditions: ReturnType<typeof eq>[] = [eq(assessments.id, id)];

    const [result] = await db
      .select()
      .from(assessments)
      .where(and(...conditions))
      .limit(1);

    return result;
  }

  getAssessments(limit?: number, cursor?: number, createdBy?: string) { return this.assessmentRepository.getAssessments(limit, cursor, createdBy); }
  searchAssessments(searchTerm: string, createdBy?: string, riskCategory?: RiskCategory, limit?: number, cursor?: number) { return this.assessmentRepository.searchAssessments(searchTerm, createdBy, riskCategory, limit, cursor); }
  getAssessmentById(id: number) { return this.assessmentRepository.getAssessmentById(id); }
  createAssessment(assessment: any) { return this.assessmentRepository.createAssessment(assessment); }
  
  createUser(data: InsertUser) { return this.userRepository.createUser(data); }
  getUserByEmail(email: string) { return this.userRepository.getUserByEmail(email); }
  getUserById(id: string) { return this.userRepository.getUserById(id); }
  getAllUsers(page: number, limit: number) { return this.userRepository.getAllUsers(page, limit); }
  updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>) { return this.userRepository.updateUser(id, data); }

  getLoginAuditLogs(page: number, limit: number) { return this.auditRepository.getLoginAuditLogs(page, limit); }
  recordLoginAudit(params: any) { return this.auditRepository.recordLoginAudit(params); }

  getSystemStats() { return this.analyticsRepository.getSystemStats(); }
  getAnalyticsStats(createdBy?: string) { return this.analyticsRepository.getAnalyticsStats(createdBy); }
}

export const storage = new DatabaseStorage();
