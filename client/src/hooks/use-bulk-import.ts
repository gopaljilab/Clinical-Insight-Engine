import { useState, useCallback } from "react";
import { ApiClient } from "@/lib/apiClient";
import { buildCsvImportPreview, type ImportPreviewSummary, type ImportAssessmentRow } from "@/utils/csvImportPreview";

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
}

export interface BulkImportActions {
  parseFile: (file: File) => Promise<void>;
  confirmImport: () => Promise<void>;
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
};

export function useBulkImport(): BulkImportState & BulkImportActions {
  const [state, setState] = useState<BulkImportState>(INITIAL_STATE);

  const reset = useCallback(() => setState(INITIAL_STATE), []);

  const parseFile = useCallback(async (file: File) => {
    setState((s) => ({ ...s, step: "parsing", progress: 10, fileName: file.name, fileSize: file.size, error: null }));

    try {
      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
      let parsedRows: Record<string, unknown>[];

      if (isExcel) {
        const XLSX = await import("xlsx");
        setState((s) => ({ ...s, progress: 25 }));

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

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
    } catch (err: any) {
      setState((s) => ({
        ...s,
        step: "error",
        error: err.message || "Failed to parse file.",
        progress: 50,
      }));
    }
  }, []);

  const confirmImport = useCallback(async () => {
    if (!state.preview || state.preview.validRows.length === 0) return;

    setState((s) => ({ ...s, step: "importing", progress: 70, error: null }));

    try {
      const assessments = state.preview.validRows.map((r) => r.data!) as ImportAssessmentRow[];

      const progressInterval = setInterval(() => {
        setState((s) => {
          if (s.progress < 95) return { ...s, progress: s.progress + 2 };
          return s;
        });
      }, 300);

      const data = await ApiClient.post("/api/assessments/bulk", { assessments });

      clearInterval(progressInterval);
      setState((s) => ({
        ...s,
        step: "done",
        progress: 100,
        results: data.assessments || [],
      }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        step: "error",
        error: err.message || "Import failed.",
        progress: 70,
      }));
    }
  }, [state.preview]);

  return { ...state, parseFile, confirmImport, reset };
}
