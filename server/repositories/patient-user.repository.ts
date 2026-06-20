import { getDb } from "../db";
import { patientUsers, type PatientUser, type InsertPatientUser } from "@shared/schema";
import { eq, lt, sql } from "drizzle-orm";

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

  async anonymizePatientUsersOlderThan(date: Date): Promise<number> {
    const db = getDb();
    const result = await db
      .update(patientUsers)
      .set({
        patientName: sql`'[anonymized]' || substring(id::text, 1, 8)`,
        email: sql`'anon-' || substring(id::text, 1, 8) || '@anonymized.local'`,
      })
      .where(lt(patientUsers.createdAt, date))
      .returning({ id: patientUsers.id });
    return result.length;
  }

  async purgePatientUsersOlderThan(date: Date): Promise<number> {
    const db = getDb();
    const result = await db.delete(patientUsers).where(lt(patientUsers.createdAt, date)).returning({ id: patientUsers.id });
    return result.length;
  }
}
