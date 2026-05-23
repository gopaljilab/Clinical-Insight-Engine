import { db } from "./db";
import { assessments, type Assessment, type AssessmentFactor, type InsertAssessment } from "@shared/schema";

export type AssessmentCreateInput = Omit<InsertAssessment, "confidenceInterval" | "modelConfidence"> & {
  riskScore: string;
  riskCategory: string;
  factors: AssessmentFactor[];
  confidenceInterval?: string | null;
  modelConfidence?: string | null;
};

export interface IStorage {
  getAssessments(): Promise<Assessment[]>;
  createAssessment(assessment: AssessmentCreateInput): Promise<Assessment>;
}

export class DatabaseStorage implements IStorage {
  async getAssessments(): Promise<Assessment[]> {
    return await db.select().from(assessments);
  }

  async createAssessment(assessment: AssessmentCreateInput): Promise<Assessment> {
    const dbAssessment = {
      ...assessment,
      bmi: String(assessment.bmi),
      hba1cLevel: String(assessment.hba1cLevel),
      bloodGlucoseLevel: String(assessment.bloodGlucoseLevel),
      modelConfidence:
        assessment.modelConfidence == null
          ? assessment.modelConfidence
          : String(assessment.modelConfidence),
    };

    const [created] = await db.insert(assessments).values(dbAssessment).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
