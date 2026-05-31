import { getDb } from "./db";
import { eq, desc } from "drizzle-orm";
import {
  assessments,
  users,
  type Assessment,
  type InsertAssessment,
  type AssessmentFactor,
  type User,
  type InsertUser
} from "@shared/schema";
import { and, desc, eq } from "drizzle-orm";



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

    const filters: any[] = [];
    if (createdBy) {
      filters.push(eq(assessments.createdBy, createdBy));
    }

    const query = db
      .select()
      .from(assessments)
      .orderBy(desc(assessments.createdAt))
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