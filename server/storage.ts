import { getDb } from "./db";
import { and, desc, eq, ilike, or, sql, lt } from "drizzle-orm";

import {
  assessments,
  users,
  loginAuditLogs,
  type Assessment,
  type InsertAssessment,
  type AssessmentFactor,
  type User,
  type InsertUser,
} from "@shared/schema";
import type { RiskCategory } from "./validation/searchValidation";

export interface IStorage {
  getAssessments(limit?: number, cursor?: number, createdBy?: string): Promise<{ data: Assessment[]; nextCursor: number | null }>;
  createAssessment(assessment: AssessmentCreateInput): Promise<Assessment>;
  searchAssessments(
    searchTerm: string,
    createdBy?: string,
    riskCategory?: RiskCategory,
    limit?: number,
    cursor?: number
  ): Promise<{ data: Assessment[]; nextCursor: number | null }>;
  /** Returns a single assessment by numeric ID. Authorization must be checked by caller. */
  getAssessmentById(id: number): Promise<Assessment | undefined>;
  createUser(data: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(page: number, limit: number): Promise<{ data: User[]; total: number }>;
  getLoginAuditLogs(page: number, limit: number): Promise<{ data: typeof loginAuditLogs.$inferSelect[]; total: number }>;
  updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>): Promise<User>;
  getSystemStats(): Promise<{
    totalUsers: number;
    totalAssessments: number;
    riskDistribution: { category: string; count: number }[];
  }>;
  recordLoginAudit(params: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    loginStatus: string;
  }): Promise<void>;
  getAnalyticsStats(createdBy?: string): Promise<any>;
}

export type AssessmentCreateInput = InsertAssessment & {
  // Server-side fields (model outputs)
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

    const conditions: ReturnType<typeof eq>[] = [];

    if (createdBy) {
      conditions.push(eq(assessments.createdBy, createdBy));
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
        confidenceInterval: assessments.confidenceInterval,
        modelConfidence: assessments.modelConfidence,
        createdBy: assessments.createdBy,
        createdAt: assessments.createdAt,
        userId: assessments.userId,
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
   * @param searchTerm   Free-text search term (validated upstream by searchValidation.ts)
   * @param createdBy    Restrict results to this user's own records
   * @param riskCategory Optional filter: LOW | MODERATE | HIGH
   * @param limit        Maximum rows to return (default 20)
   * @param offset       Pagination offset (default 0)
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

    // Always scope results to the requesting user when available
    if (createdBy) {
      conditions.push(eq(assessments.createdBy, createdBy));
    }

    // Risk category exact-match filter (parameterized)
    if (riskCategory) {
      conditions.push(eq(assessments.riskCategory, riskCategory));
    }

    if (cursor !== undefined) {
      conditions.push(lt(assessments.id, cursor) as any);
    }

    // Free-text search across gender and smokingHistory fields
    // ilike() uses PostgreSQL's case-insensitive LIKE with bound parameters:
    //   WHERE (gender ILIKE $N OR smoking_history ILIKE $N)
    // The `searchTerm` value is NEVER interpolated — Drizzle sends it as a placeholder.
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

  async createAssessment(
    assessment: AssessmentCreateInput
  ): Promise<Assessment> {

    const db = getDb();

    const [created] = await db
      .insert(assessments)
      .values(assessment)
      .returning();

    return created;
  }

  async createUser(data: InsertUser): Promise<User> {
    const db = getDb();
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(page: number = 1, limit: number = 20): Promise<{ data: User[]; total: number }> {
    const db = getDb();
    const offset = (page - 1) * limit;
    const data = await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
    return { data, total: Number(count) };
  }

  async getLoginAuditLogs(page: number = 1, limit: number = 20): Promise<{ data: typeof loginAuditLogs.$inferSelect[]; total: number }> {
    const db = getDb();
    const offset = (page - 1) * limit;
    const data = await db.select().from(loginAuditLogs).orderBy(desc(loginAuditLogs.createdAt)).limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(loginAuditLogs);
    return { data, total: Number(count) };
  }

  async updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>): Promise<User> {
    const db = getDb();
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

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

export const storage = new DatabaseStorage();
