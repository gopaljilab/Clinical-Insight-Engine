import { getDb } from "../db";
import { desc, eq, sql } from "drizzle-orm";
import { users, type User, type InsertUser } from "@shared/schema";

export class UserRepository {
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

  async getAllUsers(page: number = 1, limit: number = 20): Promise<{ data: User[]; total: number }> {
    const db = getDb();
    const offset = (page - 1) * limit;
    const data = await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
    return { data, total: Number(count) };
  }

  async updateUser(id: string, data: Partial<Pick<User, "isActive" | "role">>): Promise<User> {
    const db = getDb();
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }
}
