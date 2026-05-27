import { getDb } from "./db";
import {
  assessments,
  type Assessment,
  type InsertAssessment,
  type AssessmentFactor
} from "@shared/schema";
import { desc } from "drizzle-orm";

export interface IStorage {
  getAssessments(limit?: number, offset?: number): Promise<Assessment[]>;
  createAssessment(assessment: any): Promise<Assessment>;
}

export type AssessmentCreateInput = InsertAssessment & {
  riskScore: string;
  riskCategory: string;
  factors: AssessmentFactor[];
  confidenceInterval?: string;
  modelConfidence?: string;
};

export class DatabaseStorage implements IStorage {
  async getAssessments(
    limit: number = 50,
    offset: number = 0
  ): Promise<Assessment[]> {
    const db = getDb();

    return await db
      .select()
      .from(assessments)
      .orderBy(desc(assessments.createdAt))
      .limit(limit)
      .offset(offset);
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
