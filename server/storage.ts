import { getDb } from "./db";
import {
  assessments,
  type Assessment,
  type InsertAssessment,
  type AssessmentFactor
} from "@shared/schema";
import { desc, eq } from "drizzle-orm";

export interface IStorage {
  getAssessments(limit?: number, offset?: number, createdBy?: string): Promise<Assessment[]>;
  createAssessment(assessment: any): Promise<Assessment>;
}

export type AssessmentCreateInput = InsertAssessment & {
  riskScore: number;
  riskCategory: string;
  factors: AssessmentFactor[];
  confidenceInterval?: string;
  modelConfidence?: number;
  createdBy?: string;
  createdBy: string;
  riskScore: string;
  riskCategory: string;
  factors: AssessmentFactor[];
  confidenceInterval?: string;
  modelConfidence?: string;
};

export class DatabaseStorage implements IStorage {
  async getAssessments(
    limit: number = 50,
    offset: number = 0,
    createdBy?: string
  ): Promise<Assessment[]> {
    const db = getDb();

    let query = db
      .select()
      .from(assessments)
      .orderBy(desc(assessments.createdAt));

    if (createdBy) {
      query = query.where(eq(assessments.createdBy, createdBy));
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
}

export const storage = new DatabaseStorage();
