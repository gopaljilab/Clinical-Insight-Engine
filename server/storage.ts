import { db } from "./db";
import { assessments, type Assessment, type InsertAssessment } from "@shared/schema";

export interface IStorage {
  getAssessments(): Promise<Assessment[]>;
  createAssessment(assessment: InsertAssessment & { 
    riskScore: string, 
    riskCategory: string, 
    factors: any,
    confidenceInterval?: string,
    modelConfidence?: string 
  }): Promise<Assessment>;
}

export class DatabaseStorage implements IStorage {
  async getAssessments(): Promise<Assessment[]> {
    return await db.select().from(assessments);
  }

  async createAssessment(assessment: InsertAssessment & { 
    riskScore: string, 
    riskCategory: string, 
    factors: any,
    confidenceInterval?: string,
    modelConfidence?: string 
  }): Promise<Assessment> {
    const [created] = await db.insert(assessments).values(assessment).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
