import { AsyncLocalStorage } from "async_hooks";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { logger } from "./logger";

export const dbRlsStorage = new AsyncLocalStorage<NodePgDatabase<typeof schema>>();

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

export function isTransientError(error: unknown): boolean {
  if (!error) return false;
  const message = (error as Error).message || String(error);
  const code = (error as any).code;

  const transientCodes = new Set([
    "08000", "08003", "08006", "08001", "08004",
    "57P01", "57P02", "57P03", "40001", "40003"
  ]);

  if (typeof code === "string" && transientCodes.has(code)) {
    return true;
  }

  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes("connection terminated") ||
    lowerMessage.includes("connreset") ||
    lowerMessage.includes("econnreset") ||
    lowerMessage.includes("econnrefused") ||
    lowerMessage.includes("etimedout") ||
    lowerMessage.includes("epipe") ||
    lowerMessage.includes("timeout expired") ||
    lowerMessage.includes("failed to acquire a connection") ||
    lowerMessage.includes("database is unreachable") ||
    lowerMessage.includes("connection timeout") ||
    lowerMessage.includes("terminating connection")
  ) {
    return true;
  }

  return false;
}

export async function withRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  maxAttempts = 5,
  initialDelayMs = 500,
  backoffFactor = 2
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= maxAttempts || !isTransientError(error)) {
        throw error;
      }
      const delay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
      logger.warn(
        { err: error, attempt, nextRetryDelayMs: delay, operation: operationName },
        `Database operation failed with transient error. Retrying...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export function getPool() {
  if (!poolInstance) {
    const dbUrl = getDatabaseUrl();
    const useSSL =
      process.env.DB_SSL === "true" ||
      /supabase\.co|pooler\.supabase\.com/i.test(dbUrl);

    poolInstance = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      max: 10,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
    });

    poolInstance.on("error", (err) => {
      logger.error({ err }, "Unexpected error on idle database client");
    });
  }

  return poolInstance;
}

export function getDb() {
  const rlsDb = dbRlsStorage.getStore();
  if (rlsDb) return rlsDb;

  if (!dbInstance) {
    const rawDb = drizzle(getPool(), { schema });
    const originalTransaction = rawDb.transaction.bind(rawDb);
    rawDb.transaction = function (
      this: typeof rawDb,
      transactionFn: (tx: any) => Promise<any>,
      config?: any
    ) {
      return withRetry(
        "db.transaction",
        () => originalTransaction(transactionFn, config),
        5,
        500
      );
    } as any;
    dbInstance = rawDb;
  }

  return dbInstance;
}

export async function verifyDatabaseConnection() {
  try {
    await getPool().query("select 1");
  } catch (error) {
    const detail = error instanceof Error ? (error as Error).message : String(error);
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
