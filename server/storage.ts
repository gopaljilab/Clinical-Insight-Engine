import { getDb } from "./db";
import { and, desc, eq, sql } from "drizzle-orm";

import {
  assessments,
  users,
  type Assessment,
  type InsertAssessment,
  type AssessmentFactor,
  type User,
  type InsertUser
} from "@shared/schema";






export interface IStorage {
  getAssessments(limit?: number, offset?: number, createdBy?: string): Promise<Assessment[]>;
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
