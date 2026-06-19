import { useState, useCallback, useRef, useEffect } from "react";
import { ApiClient } from "@/lib/apiClient";
import { buildCsvImportPreview, type ImportPreviewSummary, type ImportAssessmentRow } from "@/utils/csvImportPreview";
import { useImportSession, type ImportSession } from "./useImportSession";

export type ImportStep =
  | "idle"
  | "parsing"
  | "validating"
  | "importing"
  | "done"
  | "error";

export interface BulkImportState {
  step: ImportStep;
  progress: number;
  preview: ImportPreviewSummary | null;
  results: any[];
  fileName: string;
  fileSize: number;
  error: string | null;
  completedRows: number;
  failedRows: number;
  totalRows: number;
  eta: number | null;
  hasInterruptedSession: boolean;
}

export interface BulkImportActions {
  parseFile: (file: File) => Promise<void>;
  confirmImport: (skipDuplicatesList?: { patientName: string; age: number; gender: string }[]) => Promise<void>;
  cancel: () => void;
  resume: () => Promise<void>;
  discardSession: () => void;
  reset: () => void;
}

const INITIAL_STATE: BulkImportState = {
  step: "idle",
  progress: 0,
  preview: null,
  results: [],
  fileName: "",
  fileSize: 0,
  error: null,
  completedRows: 0,
  failedRows: 0,
  totalRows: 0,
  eta: null,
  hasInterruptedSession: false,
};

export function useBulkImport(): BulkImportState & BulkImportActions {
  const [state, setState] = useState<BulkImportState>(INITIAL_STATE);
  const { saveSession, clearSession, getStoredSession } = useImportSession();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Detect interrupted session on mount/check
  useEffect(() => {
    const stored = getStoredSession();
    if (
      stored &&
      (stored.status === "importing" || stored.status === "cancelled" || stored.status === "error") &&
      stored.pendingRows.length > 0
    ) {
      setState((s) => ({
        ...s,
        hasInterruptedSession: true,
        fileName: stored.fileName,
        completedRows: stored.completedRows,
        failedRows: stored.failedRows,
        totalRows: stored.totalRows,
        results: stored.results,
      }));
    }
  }, [getStoredSession]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
    const stored = getStoredSession();
    if (stored && stored.status === "done") {
      clearSession();
    }
  }, [clearSession, getStoredSession]);

  const parseFile = useCallback(async (file: File) => {
    setState((s) => ({
      ...s,
      step: "parsing",
      progress: 10,
      fileName: file.name,
      fileSize: file.size,
      error: null,
    }));

    try {
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      let parsedRows: Record<string, unknown>[];

      if (isExcel) {
        const XLSX = await import("xlsx");
        setState((s) => ({ ...s, progress: 25 }));

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];

        parsedRows = json.map((row) => {
          const normalized: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(row)) {
            const trimmed = key.trim();
            normalized[trimmed] = val;
          }
          return normalized;
        });
      } else {
        const Papa = (await import("papaparse")).default;
        const result = await new Promise<Papa.ParseResult<Record<string, unknown>>>((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: resolve,
            error: reject,
          });
        });
        parsedRows = result.data;
      }

      setState((s) => ({ ...s, step: "validating", progress: 50 }));

      const preview = buildCsvImportPreview(parsedRows);

      if (preview.validRows.length === 0) {
        setState((s) => ({
          ...s,
          step: "error",
          error: "No valid rows found in the file. Check the preview for details.",
          preview,
          progress: 50,
        }));
        return;
      }

      setState((s) => ({ ...s, step: "validating", preview, progress: 60 }));
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        step: "error",
        error: (err as Error).message || "Failed to parse file.",
        progress: 50,
      }));
    }
  }, []);

  const startImportLoop = useCallback(
    async (
      sessionData: ImportSession,
      skipDuplicatesList?: { patientName: string; age: number; gender: string }[]
    ) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      let currentSession: ImportSession = { ...sessionData, status: "importing" };

      if (skipDuplicatesList && skipDuplicatesList.length > 0) {
        const dupKeys = new Set(
          skipDuplicatesList.map((d) => `${d.patientName.toLowerCase()}::${d.age}::${d.gender}`)
        );
        const filtered = currentSession.pendingRows.filter((row) => {
          const name = row.patientName || row.name || "Unknown Patient";
          const key = `${name.toLowerCase()}::${Number(row.age)}::${row.gender}`;
          return !dupKeys.has(key);
        });
        currentSession.pendingRows = filtered;
        currentSession.totalRows = currentSession.completedRows + currentSession.failedRows + filtered.length;
      }

      saveSession(currentSession);
      setState((s) => ({
        ...s,
        step: "importing",
        progress: 0,
        fileName: currentSession.fileName,
        results: currentSession.results,
        completedRows: currentSession.completedRows,
        failedRows: currentSession.failedRows,
        totalRows: currentSession.totalRows,
        error: null,
        hasInterruptedSession: false,
      }));

      const BATCH_SIZE = 10;
      const startTime = Date.now();

      try {
        while (currentSession.pendingRows.length > 0) {
          if (controller.signal.aborted) {
            throw new DOMException("Aborted", "AbortError");
          }

          const batch = currentSession.pendingRows.slice(0, BATCH_SIZE);

          try {
            const data: { assessments?: any[] } = await ApiClient.post(
              "/api/assessments/bulk",
              { assessments: batch },
              { signal: controller.signal }
            );

            const newResults = [...currentSession.results, ...(data.assessments || [])];
            const newCompleted = currentSession.completedRows + batch.length;

            currentSession = {
              ...currentSession,
              completedRows: newCompleted,
              results: newResults,
              pendingRows: currentSession.pendingRows.slice(BATCH_SIZE),
            };
          } catch (batchErr: any) {
            if (batchErr.name === "AbortError" || controller.signal.aborted) {
              throw new DOMException("Aborted", "AbortError");
            }
            const newFailed = currentSession.failedRows + batch.length;
            currentSession = {
              ...currentSession,
              failedRows: newFailed,
              pendingRows: currentSession.pendingRows.slice(BATCH_SIZE),
            };
          }

          const completedTotal = currentSession.completedRows + currentSession.failedRows;
          const progress = Math.min(100, Math.round((completedTotal / currentSession.totalRows) * 100));

          const elapsedMs = Date.now() - startTime;
          const timePerRow = completedTotal > 0 ? elapsedMs / completedTotal : 0;
          const remainingRows = currentSession.totalRows - completedTotal;
          const etaSeconds = Math.max(0, Math.round((remainingRows * timePerRow) / 1000));

          currentSession.status = "importing";
          saveSession(currentSession);

          setState((s) => ({
            ...s,
            progress,
            completedRows: currentSession.completedRows,
            failedRows: currentSession.failedRows,
            results: currentSession.results,
            eta: etaSeconds,
          }));
        }

        currentSession.status = "done";
        saveSession(currentSession);
        setState((s) => ({
          ...s,
          step: "done",
          progress: 100,
          completedRows: currentSession.completedRows,
          failedRows: currentSession.failedRows,
          results: currentSession.results,
          eta: null,
        }));
        clearSession();
      } catch (err: any) {
        if (err.name === "AbortError") {
          currentSession.status = "cancelled";
          saveSession(currentSession);
          setState((s) => ({
            ...s,
            step: "error",
            error: "Import cancelled by user.",
            eta: null,
          }));
        } else {
          currentSession.status = "error";
          currentSession.error = err.message || "Import failed.";
          saveSession(currentSession);
          setState((s) => ({
            ...s,
            step: "error",
            error: err.message || "Import failed.",
            eta: null,
          }));
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [saveSession, clearSession]
  );

  const confirmImport = useCallback(
    async (skipDuplicatesList?: { patientName: string; age: number; gender: string }[]) => {
      if (!state.preview || state.preview.validRows.length === 0) return;

      const newSession: ImportSession = {
        id: Date.now().toString(),
        fileName: state.fileName,
        totalRows: state.preview.validRows.length,
        completedRows: 0,
        failedRows: 0,
        status: "importing",
        error: null,
        results: [],
        pendingRows: state.preview.validRows.map((r) => r.data!),
      };

      await startImportLoop(newSession, skipDuplicatesList);
    },
    [state.preview, state.fileName, startImportLoop]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const resume = useCallback(async () => {
    const stored = getStoredSession();
    if (stored) {
      setState((s) => ({ ...s, hasInterruptedSession: false }));
      await startImportLoop(stored);
    }
  }, [getStoredSession, startImportLoop]);

  const discardSession = useCallback(() => {
    clearSession();
    setState(INITIAL_STATE);
  }, [clearSession]);

  return {
    ...state,
    parseFile,
    confirmImport,
    cancel,
    resume,
    discardSession,
    reset,
  };
}
