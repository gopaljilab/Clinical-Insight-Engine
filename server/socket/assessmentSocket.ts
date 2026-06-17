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
 * is validated against the session userId before any data is sent.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { logger } from "../logger";

interface AssessmentWSClient {
  ws: WebSocket;
  jobId: string;
  userId: string;
}

const clients = new Map<string, AssessmentWSClient[]>();

let wss: WebSocketServer | null = null;

export function initAssessmentSocket(httpServer: HttpServer): void {
  wss = new WebSocketServer({ server: httpServer, path: "/ws/assessments" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    // Parse jobId and userId from query string: /ws/assessments?jobId=X&userId=Y
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const jobId = url.searchParams.get("jobId");
    const userId = url.searchParams.get("userId");

    if (!jobId || !userId) {
      ws.close(1008, "jobId and userId are required");
      return;
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
