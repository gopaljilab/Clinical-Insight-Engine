import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { getPool, dbRlsStorage } from "./db";

export interface RlsUserContext {
  userId: string;
  email: string;
  role: string;
  patientName?: string;
}

export function getRlsDb(): NodePgDatabase<typeof schema> | undefined {
  return dbRlsStorage.getStore();
}

export async function createRlsClient(context: RlsUserContext): Promise<{
  db: NodePgDatabase<typeof schema>;
  client: pg.PoolClient;
}> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [context.userId],
    );
    await client.query(
      "SELECT set_config('app.current_user_email', $1, true)",
      [context.email],
    );
    await client.query(
      "SELECT set_config('app.current_user_role', $1, true)",
      [context.role],
    );
    if (context.patientName) {
      await client.query(
        "SELECT set_config('app.current_user_patient_name', $1, true)",
        [context.patientName],
      );
    }
  } catch (err) {
    client.release();
    throw err;
  }

  const db = drizzle(client, { schema });
  return { db, client };
}

export function runWithRlsDb<T>(
  db: NodePgDatabase<typeof schema>,
  fn: () => T,
): T {
  return dbRlsStorage.run(db, fn);
}
