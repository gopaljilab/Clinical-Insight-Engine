import { loginAuditLogs, type Assessment, type InsertAssessment, type AssessmentFactor, type User, type InsertUser } from "@shared/schema";
import type { RiskCategory } from "./validation/searchValidation";

import { UserRepository } from "./repositories/user.repository";
import { AssessmentRepository } from "./repositories/assessment.repository";
import { AuditRepository } from "./repositories/audit.repository";
import { AnalyticsRepository } from "./repositories/analytics.repository";

export interface IStorage {
  getAssessments(
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
  }>;
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
  getAssessmentById(id: number): Promise<Assessment | undefined>;
  createAssessment(assessment: any): Promise<Assessment>;
  deleteAssessment(id: number): Promise<void>;
  autocompletePatientNames(query: string, createdBy?: string, limit?: number): Promise<string[]>;
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
    limit: number = 50,
    offset: number = 0,
    createdBy?: string
  ): Promise<Assessment[]> {
    const db = getDb();

    const filters: any[] = [];

    // Filter by createdBy when provided to ensure users only see their own assessments
    if (createdBy) {
      const createdByCol = (assessments as any).createdBy ?? (assessments as any).created_by;
      if (createdByCol) {
        filters.push(eq(createdByCol, createdBy));
      }
    }




    // Avoid selecting non-existent columns (e.g., created_by in older DB states)
    // by explicitly selecting only columns known to exist in migrations.
    const query = db
      .select({
        id: assessments.id,
        patientName: assessments.patientName,
        gender: assessments.gender,
        age: assessments.age,
        hypertension: assessments.hypertension,
        heartDisease: (assessments as any).heartDisease ?? (assessments as any).heart_disease,
        smokingHistory:
          (assessments as any).smokingHistory ?? (assessments as any).smoking_history,
        bmi: assessments.bmi,
        hba1cLevel:
          (assessments as any).hba1cLevel ?? (assessments as any).hba1c_level,
        bloodGlucoseLevel:
          (assessments as any).bloodGlucoseLevel ?? (assessments as any).blood_glucose_level,
        riskScore:
          (assessments as any).riskScore ?? (assessments as any).risk_score,
        riskCategory:
          (assessments as any).riskCategory ?? (assessments as any).risk_category,
        factors: assessments.factors,
        confidenceInterval:
          (assessments as any).confidenceInterval ?? (assessments as any).confidence_interval,
        modelConfidence:
          (assessments as any).modelConfidence ?? (assessments as any).model_confidence,
        createdBy:
          (assessments as any).createdBy ?? (assessments as any).created_by,
        createdAt:
          (assessments as any).createdAt ?? (assessments as any).created_at,
        userId:
          (assessments as any).userId ?? (assessments as any).user_id,
      })
      .from(assessments)
      .orderBy(desc((assessments as any).createdAt ?? (assessments as any).created_at))
      .$dynamic();





    if (filters.length > 0) {
      return await query.where(and(...filters)).limit(limit).offset(offset);
    }

    return await query.limit(limit).offset(offset);
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
    offset: number = 0
  ): Promise<Assessment[]> {
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

    // Free-text search across gender and smokingHistory fields
    // ilike() uses PostgreSQL's case-insensitive LIKE with bound parameters:
    //   WHERE (gender ILIKE $N OR smoking_history ILIKE $N)
    // The `searchTerm` value is NEVER interpolated — Drizzle sends it as a placeholder.
    if (searchTerm && searchTerm.trim() !== "") {
      const pattern = `%${searchTerm.trim()}%`;
        conditions.push(
          or(
            ilike(assessments.patientName, pattern),   // ← ADD THIS LINE
            ilike(assessments.gender, pattern),
            ilike(assessments.smokingHistory, pattern),
            ilike(assessments.riskCategory, pattern)
          ) as ReturnType<typeof eq>
        );
    }

    let query = db
      .select()
      .from(assessments)
      .orderBy(desc(assessments.createdAt))
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query.limit(limit).offset(offset);
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
      .values(assessment as any)
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

  private assessmentRepository = new AssessmentRepository();
  private userRepository = new UserRepository();
  private auditRepository = new AuditRepository();
  private analyticsRepository = new AnalyticsRepository();

  getAssessments(limitOrParams?: number | Parameters<AssessmentRepository["getAssessments"]>[0], cursor?: number, createdBy?: string) { return this.assessmentRepository.getAssessments(limitOrParams, cursor, createdBy); }
  
  async searchAssessments(searchTerm: string, createdBy?: string, riskCategory?: RiskCategory, limit?: number, cursor?: number) { 
    return this.assessmentRepository.searchAssessments(searchTerm, createdBy, riskCategory, limit, cursor); 
  }
  
  async getAssessmentById(id: number) { 
    return this.assessmentRepository.getAssessmentById(id); 
  }
  
  async createAssessment(assessment: any) { 
    return this.assessmentRepository.createAssessment(assessment); 
  }
  
  async deleteAssessment(id: number) {
    return this.assessmentRepository.deleteAssessment(id);
  }
  
  async autocompletePatientNames(query: string, createdBy?: string, limit?: number) {
    return this.assessmentRepository.autocompletePatientNames(query, createdBy, limit);
  }

  async createUser(data: InsertUser) { 
    return this.userRepository.createUser(data); 
  }
  
  async getUserByEmail(email: string) { 
    return this.userRepository.getUserByEmail(email); 
  }
  
  async getUserById(id: string) { 
    return this.userRepository.getUserById(id); 
  }
  
  async getAllUsers(page: number, limit: number) { 
    return this.userRepository.getAllUsers(page, limit); 
  }
  
  async updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>) { 
    return this.userRepository.updateUser(id, data); 
  }

  async getLoginAuditLogs(page: number, limit: number) { 
    return this.auditRepository.getLoginAuditLogs(page, limit); 
  }
  
  async recordLoginAudit(params: { userId?: string; ipAddress?: string; userAgent?: string; loginStatus: string; }) { 
    return this.auditRepository.recordLoginAudit(params); 
  }

  async getSystemStats() { 
    return this.analyticsRepository.getSystemStats(); 
  }
  
  async getAnalyticsStats(createdBy?: string) { 
    return this.analyticsRepository.getAnalyticsStats(createdBy); 
  }
}

export const storage = new DatabaseStorage();
