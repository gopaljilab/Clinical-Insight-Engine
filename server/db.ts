import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { logger } from "./logger";

const { Pool } = pg;

let poolInstance: pg.Pool | undefined;
let dbInstance: NodePgDatabase<typeof schema> | undefined;

export class DatabaseStartupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseStartupError";
  }
}

function formatDatabaseStartupMessage(detail: string) {
  return [
    `Database startup check failed: ${detail}`,
    "Set DATABASE_URL to a reachable PostgreSQL database, then run npm run db:push before starting the server.",
    "Example: DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clinical_insight_engine",
  ].join("\n");
}

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    throw new DatabaseStartupError(
      formatDatabaseStartupMessage("DATABASE_URL is not set."),
    );
  }

  return process.env.DATABASE_URL;
}

export function getPool() {
  if (!poolInstance) {
    poolInstance = new Pool({ connectionString: getDatabaseUrl(), connectionTimeoutMillis: 5000, idleTimeoutMillis: 10000 });
  }

  return poolInstance;
}

export function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle(getPool(), { schema });
  }

  return dbInstance;
}

export async function verifyDatabaseConnection() {
  try {
    await getPool().query("select 1");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new DatabaseStartupError(
      formatDatabaseStartupMessage(`PostgreSQL is unreachable. ${detail}`),
    );
  }
}

export async function closePool(): Promise<void> {
  if (poolInstance) {
    try {
      await poolInstance.end();
    } catch (error) {
      logger.error({ err: error }, "Error closing database pool");
    }
    poolInstance = undefined;
    dbInstance = undefined;
  }
}
