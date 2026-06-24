import type { Request, Response, NextFunction } from "express";
import { createRlsClient, runWithRlsDb, type RlsUserContext } from "../db-rls";
import { getDb } from "../db";
import { patientUsers } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import pg from "pg";

async function resolvePatientName(userId: string): Promise<string | undefined> {
  try {
    const db = getDb();
    const [patient] = await db
      .select({ patientName: patientUsers.patientName })
      .from(patientUsers)
      .where(eq(patientUsers.id, userId))
      .limit(1);
    return patient?.patientName;
  } catch {
    return undefined;
  }
}

async function extractJwtFromHeader(req: Request): Promise<{ sub: string; email: string; role: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;

  const token = parts[1];
  if (!token || !token.includes(".")) return null;

  try {
    const { verifyToken } = await import("../services/auth/tokenValidator");
    const result = verifyToken(token);
    if (result.valid && result.payload) {
      return {
        sub: result.payload.sub,
        email: result.payload.email,
        role: result.payload.role ?? "provider",
      };
    }
  } catch {
    // Ignore invalid tokens
  }

  return null;
}

export async function rlsContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  let context: RlsUserContext | undefined;

  if (req.session?.user) {
    context = {
      userId: req.session.user.id,
      email: req.session.user.email,
      role: req.session.user.role ?? "provider",
    };
  } else if (req.jwtUser) {
    context = {
      userId: req.jwtUser.sub,
      email: req.jwtUser.email,
      role: req.jwtUser.role ?? "provider",
    };
    if (context.role === "PATIENT") {
      context.patientName = await resolvePatientName(context.userId);
    }
  }

  if (!context) {
    const jwtPayload = await extractJwtFromHeader(req);
    if (jwtPayload) {
      context = {
        userId: jwtPayload.sub,
        email: jwtPayload.email,
        role: jwtPayload.role,
      };
      if (context.role === "PATIENT") {
        context.patientName = await resolvePatientName(context.userId);
      }
    }
  }

  const authUser = (req as any).authenticatedUser;
  if (!context && authUser) {
    context = {
      userId: authUser.id,
      email: authUser.email,
      role: authUser.role ?? "provider",
    };
  }

  if (!context) {
    return next();
  }

  let client: pg.PoolClient | null = null;

  try {
    const rls = await createRlsClient(context);
    client = rls.client;

    let released = false;
    const releaseClient = () => {
      if (released) return;
      released = true;
      if (client) {
        try {
          client.release();
        } catch (err) {
          logger.error({ err }, "Failed to release RLS database client");
        }
        client = null;
      }
    };

    res.on("finish", releaseClient);
    res.on("close", releaseClient);

    const safetyTimer = setTimeout(() => {
      if (!released) {
        logger.warn("RLS client not released within 30s, forcing release");
        releaseClient();
      }
    }, 30000);

    res.on("close", () => clearTimeout(safetyTimer));
    res.on("finish", () => clearTimeout(safetyTimer));

    try {
      runWithRlsDb(rls.db, next);
    } catch (err) {
      releaseClient();
      throw err;
    }
  } catch (err) {
    if (client) {
      try { client.release(); } catch { /* ignore */ }
    }
    logger.error({ err }, "Failed to set up RLS context");
    next(err);
  }
}
