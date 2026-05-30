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
  riskScore: string;
  riskCategory: string;
  factors: AssessmentFactor[];
  confidenceInterval?: string;
  modelConfidence?: string;
  createdBy?: string;
};
export class DatabaseStorage implements IStorage {
  async getAssessments(
    limit: number = 50,
    offset: number = 0,
    createdBy?: string
  ): Promise<Assessment[]> {
    const db = getDb();
    if (createdBy) {
      return await db
        .select()
        .from(assessments)
        .where(eq(assessments.createdBy, createdBy))
        .orderBy(desc(assessments.createdAt))
        .limit(limit)
        .offset(offset);
    }
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
      .values({
        ...assessment,
        bmi: String(assessment.bmi),
        hba1cLevel: String(assessment.hba1cLevel),
        bloodGlucoseLevel: String(assessment.bloodGlucoseLevel)
      })
      .returning();
    return created;
  }
}
export const storage = new DatabaseStorage();
