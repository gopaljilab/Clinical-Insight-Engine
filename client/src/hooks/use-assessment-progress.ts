/**
 * Hook that subscribes to real-time assessment progress updates via WebSocket.
 * Replaces the HTTP polling loop in use-assessments.ts for 202 responses.
 *
 * Usage:
 *   const { percent, stage, result, error } = useAssessmentProgress(jobId, userId);
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
 * React hook for  assessment progress.
 * @param jobId - The jobId parameter.
 * @param userId - The userId parameter.
 * @returns The result of the operation.
 */
export function useAssessmentProgress(
  jobId: string | null,
  userId: string | null
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
    if (!jobId || !userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/assessments?jobId=${encodeURIComponent(jobId)}&userId=${encodeURIComponent(userId)}`;

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

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [jobId, userId]);

  return state;
}
