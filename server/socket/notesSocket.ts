import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { logger } from "../logger";
import { type AssessmentNote } from "@shared/schema";

interface NotesWSClient {
  ws: WebSocket;
  assessmentId: number;
}

const clients = new Map<number, NotesWSClient[]>();
let wss: WebSocketServer | null = null;

export function initNotesSocket(httpServer: HttpServer): void {
  wss = new WebSocketServer({ server: httpServer, path: "/ws/notes" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const assessmentIdStr = url.searchParams.get("assessmentId");
    
    if (!assessmentIdStr) {
      ws.close(1008, "assessmentId is required");
      return;
    }
    
    const assessmentId = parseInt(assessmentIdStr, 10);
    if (isNaN(assessmentId)) {
      ws.close(1008, "Invalid assessmentId");
      return;
    }

    const client: NotesWSClient = { ws, assessmentId };
    const existing = clients.get(assessmentId) ?? [];
    clients.set(assessmentId, [...existing, client]);

    logger.info({ assessmentId }, "[WS] Client subscribed to assessment notes");

    ws.on("close", () => {
      const remaining = (clients.get(assessmentId) ?? []).filter((c) => c !== client);
      if (remaining.length === 0) {
        clients.delete(assessmentId);
      } else {
        clients.set(assessmentId, remaining);
      }
      logger.info({ assessmentId }, "[WS] Client unsubscribed from assessment notes");
    });
    
    // Send a heartbeat ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);
    
    ws.on("close", () => clearInterval(pingInterval));
  });
}

export function broadcastNote(assessmentId: number, note: AssessmentNote & { user: { fullName: string } }): void {
  const subscribers = clients.get(assessmentId) ?? [];
  if (subscribers.length === 0) return;

  const message = JSON.stringify({
    type: "new_note",
    note,
  });

  for (const client of subscribers) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}
