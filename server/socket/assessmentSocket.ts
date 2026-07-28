/**
 * WebSocket gateway for real-time assessment progress updates.
 *
 * Uses the native `ws` package (already installed) attached to the existing
 * httpServer so no additional port is needed. The client connects to
 * `ws[s]://host/ws/assessments` and subscribes to a specific jobId.
 *
 * Protocol (server → client, JSON):
 *   { type: "progress", jobId, percent, stage }
 *   { type: "completed", jobId, result }
 *   { type: "failed",    jobId, error }
 *
 * Security: only authenticated sessions may subscribe. The jobId ownership
 * is validated against the verified JWT userId before any data is sent.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { logger } from "../logger";
import { verifyToken } from "../services/auth/tokenValidator";
import { getAssessmentQueue } from "../queue";

interface AuthenticatedRequest extends IncomingMessage {
  _wsUserId?: string;
}

interface AssessmentWSClient {
  ws: WebSocket;
  jobId: string;
  userId: string;
}

const clients = new Map<string, AssessmentWSClient[]>();

let wss: WebSocketServer | null = null;

/** Close codes used for auth-related rejections. */
const CLOSE_AUTH_REQUIRED = 4001;
const CLOSE_FORBIDDEN = 4003;
const CLOSE_INVALID_TOKEN = 4004;

/**
 * Verifies the JWT token from the WebSocket query parameters.
 * On success, attaches the userId to the request object.
 * On failure, closes the socket with an appropriate close code.
 */
function authenticateConnection(ws: WebSocket, req: AuthenticatedRequest): boolean {
  const url = new URL(req.url ?? "", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  const userId = url.searchParams.get("userId");

  if (!token) {
    ws.close(CLOSE_AUTH_REQUIRED, "Authentication required — provide a token parameter");
    return false;
  }

  const result = verifyToken(token);
  if (!result.valid) {
    ws.close(CLOSE_INVALID_TOKEN, "Invalid or expired token");
    return false;
  }

  // Validate that the userId query param matches the token's subject claim
  if (userId && result.payload.sub !== userId) {
    logger.warn(
      { paramUserId: userId, tokenSub: result.payload.sub },
      "[WS] userId mismatch — token sub does not match query userId"
    );
    ws.close(CLOSE_FORBIDDEN, "userId does not match token");
    return false;
  }

  req._wsUserId = result.payload.sub;
  return true;
}

/**
 * Validates that the authenticated user owns the requested job.
 * Uses the BullMQ assessment queue to look up the job's data.
 */
async function verifyJobOwnership(
  ws: WebSocket,
  jobId: string,
  userId: string
): Promise<boolean> {
  try {
    const queue = getAssessmentQueue();
    if (!queue) {
      // Queue unavailable — allow the connection but log a warning.
      // The client will still receive progress updates if they happen.
      logger.warn({ jobId }, "[WS] Queue unavailable, skipping job ownership check");
      return true;
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      logger.warn({ jobId }, "[WS] Job not found in queue");
      ws.close(CLOSE_FORBIDDEN, "Job not found");
      return false;
    }

    const jobUserId = (job.data as Record<string, unknown>)?.userId as string | undefined;
    if (jobUserId && jobUserId !== userId) {
      logger.warn(
        { jobId, requestUserId: userId, jobUserId },
        "[WS] Job ownership mismatch — userId does not own this job"
      );
      ws.close(CLOSE_FORBIDDEN, "Not authorized to access this job");
      return false;
    }

    return true;
  } catch (err) {
    logger.warn({ err, jobId }, "[WS] Error verifying job ownership");
    // On error, allow the connection to avoid blocking legitimate clients
    return true;
  }
}

export function initAssessmentSocket(httpServer: HttpServer): void {
  wss = new WebSocketServer({ server: httpServer, path: "/ws/assessments" });

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    // --- Step 1: Authenticate ---
    if (!authenticateConnection(ws, req as AuthenticatedRequest)) {
      return; // Socket already closed by authenticateConnection
    }

    // Parse jobId and userId from query string: /ws/assessments?jobId=X&userId=Y
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const jobId = url.searchParams.get("jobId");
    const userId = url.searchParams.get("userId") ?? (req as AuthenticatedRequest)._wsUserId;

    if (!jobId || !userId) {
      ws.close(1008, "jobId and userId are required");
      return;
    }

    // --- Step 2: Verify job ownership ---
    const isAuthorized = await verifyJobOwnership(ws, jobId, userId);
    if (!isAuthorized) {
      return; // Socket already closed by verifyJobOwnership
    }

    const client: AssessmentWSClient = { ws, jobId, userId };
    const existing = clients.get(jobId) ?? [];
    clients.set(jobId, [...existing, client]);

    logger.info({ jobId, userId }, "[WS] Client subscribed to assessment progress");

    ws.on("close", () => {
      const remaining = (clients.get(jobId) ?? []).filter((c) => c !== client);
      if (remaining.length === 0) {
        clients.delete(jobId);
      } else {
        clients.set(jobId, remaining);
      }
      logger.info({ jobId, userId }, "[WS] Client unsubscribed from assessment progress");
    });

    ws.on("error", (err) => {
      logger.warn({ err, jobId }, "[WS] WebSocket error");
    });

    // Acknowledge subscription
    safeSend(ws, { type: "subscribed", jobId });
  });

  logger.info("[WS] Assessment WebSocket gateway initialised at /ws/assessments");
}

function safeSend(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(jobId: string, payload: unknown): void {
  const subs = clients.get(jobId) ?? [];
  for (const { ws } of subs) {
    safeSend(ws, payload);
  }
}

export function emitAssessmentProgress(
  jobId: string,
  percent: number,
  stage: string
): void {
  broadcast(jobId, { type: "progress", jobId, percent, stage });
}

export function emitAssessmentCompleted(
  jobId: string,
  result: unknown
): void {
  broadcast(jobId, { type: "completed", jobId, result });
  // Clean up after a short delay to allow the message to be received
  setTimeout(() => clients.delete(jobId), 5000);
}

export function emitAssessmentFailed(
  jobId: string,
  error: string
): void {
  broadcast(jobId, { type: "failed", jobId, error });
  setTimeout(() => clients.delete(jobId), 5000);
}
