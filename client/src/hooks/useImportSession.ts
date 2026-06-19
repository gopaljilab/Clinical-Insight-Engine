import { useState, useEffect, useCallback } from "react";

export interface ImportSession {
  id: string;
  fileName: string;
  totalRows: number;
  completedRows: number;
  failedRows: number;
  status: "idle" | "importing" | "cancelled" | "done" | "error";
  error: string | null;
  results: any[];
  pendingRows: any[];
}

const LOCAL_STORAGE_KEY = "clinical_insight_import_session";

export function useImportSession() {
  const [session, setSession] = useState<ImportSession | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse stored import session", e);
      }
    }
  }, []);

  const saveSession = useCallback((newSession: ImportSession) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newSession));
    setSession(newSession);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    setSession(null);
  }, []);

  const getStoredSession = useCallback((): ImportSession | null => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }, []);

  return {
    session,
    saveSession,
    clearSession,
    getStoredSession,
  };
}
