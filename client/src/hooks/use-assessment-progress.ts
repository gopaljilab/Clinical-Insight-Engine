/**
 * Hook that subscribes to real-time assessment progress updates via WebSocket.
 * Replaces the HTTP polling loop in use-assessments.ts for 202 responses.
 *
 * Usage:
 *   const { percent, stage, result, error } = useAssessmentProgress(jobId, userId, token);
 *
 * The `token` param is a JWT Bearer token used for WebSocket authentication.
 * It is passed as a query parameter (browser WebSocket API does not support
 * custom headers). The token is validated server-side on connection.
 */

import { useEffect, useRef, useState } from "react";

export interface AssessmentProgressState {
  percent: number;
  stage: string;
  result: unknown | null;
  error: string | null;
  isComplete: boolean;
}

/**
 * React hook for assessment progress via authenticated WebSocket.
 * @param jobId - The job identifier to subscribe to.
 * @param userId - The authenticated user's ID (for display/logging).
 * @param token  - JWT token for WebSocket authentication (required).
 * @returns The assessment progress state.
 */
export function useAssessmentProgress(
  jobId: string | null,
  userId: string | null,
  token: string | null
): AssessmentProgressState {
  const [state, setState] = useState<AssessmentProgressState>({
    percent: 0,
    stage: "Queued",
    result: null,
    error: null,
    isComplete: false,
  });

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!jobId || !userId || !token) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/assessments?jobId=${encodeURIComponent(jobId)}&userId=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === "progress") {
          setState((prev) => ({
            ...prev,
            percent: msg.percent,
            stage: msg.stage,
          }));
        } else if (msg.type === "completed") {
          setState({
            percent: 100,
            stage: "Assessment Complete",
            result: msg.result,
            error: null,
            isComplete: true,
          });
          ws.close();
        } else if (msg.type === "failed") {
          setState((prev) => ({
            ...prev,
            error: msg.error ?? "Assessment failed",
            isComplete: true,
          }));
          ws.close();
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      setState((prev) => ({
        ...prev,
        error: "WebSocket connection error. Please try again.",
        isComplete: true,
      }));
    };

    ws.onclose = (event) => {
      // Detect auth-related close codes from the server
      if (event.code === 4001) {
        setState((prev) => ({
          ...prev,
          error: "Authentication required. Please log in again.",
          isComplete: true,
        }));
      } else if (event.code === 4003 || event.code === 4004) {
        setState((prev) => ({
          ...prev,
          error: "Authentication failed. Please log in again.",
          isComplete: true,
        }));
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [jobId, userId, token]);

  return state;
}
