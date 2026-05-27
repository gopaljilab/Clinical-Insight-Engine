// server/storage.ts
import { getDb } from "./db"; // 1. Changed to import getDb instead of db
import { assessments, type Assessment, type InsertAssessment, type AssessmentFactor } from "@shared/schema";

export interface IStorage {
  getAssessments(): Promise<Assessment[]>;
  createAssessment(assessment: any): Promise<Assessment>; 
}

// Type for creating assessments with pre-computed model outputs (used in seeding)
export type AssessmentCreateInput = InsertAssessment & {
  riskScore: string;
  riskCategory: string;
  factors: AssessmentFactor[];
  confidenceInterval?: string;
  modelConfidence?: string;
};

export class DatabaseStorage implements IStorage {
  async getAssessments(): Promise<Assessment[]> {
    const db = getDb(); // 2. This works great now!
    return await db.select().from(assessments);
  }

  async createAssessment(assessment: AssessmentCreateInput): Promise<Assessment> {
    const db = getDb(); 
// Cast the values to 'any' to satisfy Drizzle's strict type checker
const [created] = await db.insert(assessments).values(assessment as any).returning();    return created;
  }
}

export const storage = new DatabaseStorage();