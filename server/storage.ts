import { getDb } from "./db";
import {
  assessments,
  type Assessment,
  type InsertAssessment,
  type AssessmentFactor
} from "@shared/schema";
import { desc, eq } from "drizzle-orm";

export interface IStorage {
  getAssessments(userId?: string, limit?: number, offset?: number): Promise<Assessment[]>;
  createAssessment(assessment: any): Promise<Assessment>;
}

export type AssessmentCreateInput = InsertAssessment & {
  userId: string;
  riskScore: string;
  riskCategory: string;
  factors: AssessmentFactor[];
  confidenceInterval?: string;
  modelConfidence?: string;
};

export class DatabaseStorage implements IStorage {
  async getAssessments(
    userId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Assessment[]> {
    const db = getDb();

    let query = db
      .select()
      .from(assessments)
      .orderBy(desc(assessments.createdAt));

    if (userId) {
      query = query.where(eq(assessments.userId, userId));
    }

    return await query.limit(limit).offset(offset);
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
}

export const storage = new DatabaseStorage();
