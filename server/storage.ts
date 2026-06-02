import { getDb } from "./db";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import {
  assessments,
  users,
  type Assessment,
  type InsertAssessment,
  type AssessmentFactor,
  type User,
  type InsertUser,
} from "@shared/schema";
import type { RiskCategory } from "./validation/searchValidation";

export interface IStorage {
  getAssessments(limit?: number, offset?: number, createdBy?: string): Promise<Assessment[]>;
  /**
   * Searches assessments by risk category label using parameterized queries.
   * Uses Drizzle ORM eq() — user input is NEVER interpolated into SQL strings.
   */
  searchAssessments(
    searchTerm: string,
    createdBy?: string,
    riskCategory?: RiskCategory,
    limit?: number,
    offset?: number
  ): Promise<Assessment[]>;
  /** Returns a single assessment by numeric ID. Authorization must be checked by caller. */
  getAssessmentById(id: number): Promise<Assessment | undefined>;
  createAssessment(assessment: any): Promise<Assessment>;
  createUser(data: InsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
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
    limit: number = 50,
    offset: number = 0,
    createdBy?: string
  ): Promise<Assessment[]> {
    const db = getDb();

    // Compatibility: allow running even if the assessments table doesn't have created_by.
    // Keep createdBy arg unused for now.
    void createdBy;

    const filters: any[] = [];




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
}

export const storage = new DatabaseStorage();
