import { getDb } from "./db";
import { eq, desc } from "drizzle-orm";
import {
  assessments,
  type Assessment,
  type InsertAssessment,
  type AssessmentFactor,
} from "@shared/schema";



export interface IStorage {
  getAssessments(limit?: number, offset?: number, createdBy?: string): Promise<Assessment[]>;
  createAssessment(assessment: any): Promise<Assessment>;
}

export type AssessmentCreateInput = InsertAssessment & {
  // Server-side fields (model outputs)
  riskScore: number;
  riskCategory: string;
  factors: AssessmentFactor[];
  confidenceInterval?: string | null;
  modelConfidence?: number | null;

  // Audit
  createdBy: string;
};



export class DatabaseStorage implements IStorage {
  async getAssessments(
    limit: number = 50,
    offset: number = 0,
    createdBy?: string
  ): Promise<Assessment[]> {
    const db = getDb();

    return await db
      .select()
      .from(assessments)
      .where(createdBy ? eq(assessments.createdBy, createdBy) : undefined)
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
      .values(assessment as any)
      .returning();

    return created;
  }
}

export const storage = new DatabaseStorage();