import { getDb } from "../db";
import { patientUsers, type PatientUser, type InsertPatientUser } from "@shared/schema";
import { eq } from "drizzle-orm";

export class PatientUserRepository {
  async findByEmail(email: string): Promise<PatientUser | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(patientUsers)
      .where(eq(patientUsers.email, email))
      .limit(1);
    return result;
  }

  async findByPatientName(patientName: string): Promise<PatientUser | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(patientUsers)
      .where(eq(patientUsers.patientName, patientName))
      .limit(1);
    return result;
  }

  async findById(id: string): Promise<PatientUser | undefined> {
    const db = getDb();
    const [result] = await db
      .select()
      .from(patientUsers)
      .where(eq(patientUsers.id, id))
      .limit(1);
    return result;
  }

  async create(data: InsertPatientUser): Promise<PatientUser> {
    const db = getDb();
    const [result] = await db.insert(patientUsers).values(data).returning();
    return result;
  }
}
