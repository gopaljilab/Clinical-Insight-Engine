import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { getPool, dbRlsStorage } from "./db";
import { logger } from "./logger";

export interface RlsUserContext {
  userId: string;
  email: string;
  role: string;
  patientName?: string;
}

const rlsStorage = dbRlsStorage;

// ── Active RLS client tracking ───────────────────────
// Tracks every checked-out client so they can be drained during shutdown.
const activeRlsClients = new Set<pg.PoolClient>();

export function getRlsDb(): NodePgDatabase<typeof schema> | undefined {
  return dbRlsStorage.getStore();
}

/**
 * Register an RLS client for tracking. Called by createRlsClient.
 */
export function registerRlsClient(client: pg.PoolClient): void {
  activeRlsClients.add(client);
}

/**
 * Unregister an RLS client. Called when the client is released.
 */
export function unregisterRlsClient(client: pg.PoolClient): void {
  activeRlsClients.delete(client);
}

/**
 * Return the number of currently active (checked-out) RLS clients.
 */
export function getActiveRlsCount(): number {
  return activeRlsClients.size;
}

/**
 * Return pool utilisation metrics for observability and health checks.
 */
export function getPoolMetrics(): {
  activeRlsClients: number;
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
} {
  const pool = getPool();
  return {
    activeRlsClients: activeRlsClients.size,
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
  };
}

/**
 * Gracefully release all tracked RLS clients. Called during shutdown
 * before the pool itself is closed.
 */
export async function drainRlsClients(): Promise<void> {
  const count = activeRlsClients.size;
  if (count === 0) return;

  logger.info({ activeRlsClients: count }, "Draining RLS clients…");

  const timeout = 10_000;
  const drainStart = Date.now();

  for (const client of activeRlsClients) {
    try {
      client.release();
    } catch (err) {
      logger.error({ err }, "Error releasing RLS client during drain");
    }
  }
  activeRlsClients.clear();

  const elapsed = Date.now() - drainStart;
  if (elapsed >= timeout) {
    logger.warn({ elapsedMs: elapsed }, "RLS client drain may have timed out");
  } else {
    logger.info({ count, elapsedMs: elapsed }, "RLS clients drained");
  }
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

  // Track this client so it can be drained on shutdown
  registerRlsClient(client);

  const db = drizzle(client, { schema });
  return { db, client };
}

export function runWithRlsDb<T>(
  db: NodePgDatabase<typeof schema>,
  fn: () => T,
): T {
  return dbRlsStorage.run(db, fn);
}
