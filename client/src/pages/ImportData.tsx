import { useRef } from "react";
import { AlertCircle, CheckCircle, Download, FileSpreadsheet, Loader2, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useBulkImport } from "@/hooks/use-bulk-import";
import { AppLayout } from "@/components/layout/AppLayout";
import type { ImportPreviewRow } from "@/utils/csvImportPreview";

const ACCEPTED_TYPES = ".csv,.xlsx,.xls";

const STEP_LABELS: Record<string, string> = {
  idle: "",
  parsing: "Parsing file...",
  validating: "Validating data...",
  importing: "Processing ML predictions...",
  done: "Import complete!",
  error: "Import failed",
};

const RISK_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MODERATE: "bg-amber-100 text-amber-700",
  LOW: "bg-emerald-100 text-emerald-700",
};

function StatusCount({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

function RowIssues({ row }: { row: ImportPreviewRow }) {
  const issues = [...row.errors, ...row.warnings];
  if (issues.length === 0) return <span className="text-slate-500">Ready to import</span>;
  return (
    <ul className="space-y-1">
      {issues.map((issue) => (
        <li key={issue} className="flex items-start gap-2">
          {row.errors.includes(issue) ? (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          )}
          <span>{issue}</span>
        </li>
      ))}
    </ul>
  );
}

function ProgressBar({ progress, step }: { progress: number; step: string }) {
  const label = STEP_LABELS[step] || "";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-bold text-blue-600">{progress}%</span>
      </div>
      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      {step === "importing" && (
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Running ML predictions for each patient record
        </p>
      )}
    </div>
  );
}

function ResultsSummary({ results }: { results: any[] }) {
  const high = results.filter((r) => (r.riskCategory || "").toUpperCase() === "HIGH").length;
  const moderate = results.filter((r) => (r.riskCategory || "").toUpperCase() === "MODERATE").length;
  const low = results.filter((r) => (r.riskCategory || "").toUpperCase() === "LOW").length;

  const csvContent = [
    ["Patient Name", "Age", "Gender", "Risk Category", "Risk Score", "Confidence Interval", "Model Confidence"].join(","),
    ...results.map((r) =>
      [r.patientName, r.age, r.gender, r.riskCategory, r.riskScore, r.confidenceInterval || "", r.modelConfidence ?? ""].join(","),
    ),
  ].join("\n");

  const downloadCsv = () => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `batch-results-${Date.now()}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatusCount label="Total" value={results.length} tone="border-slate-200 bg-slate-50 text-slate-800" />
        <StatusCount label="HIGH Risk" value={high} tone="border-red-200 bg-red-50 text-red-800" />
        <StatusCount label="Moderate" value={moderate} tone="border-amber-200 bg-amber-50 text-amber-800" />
        <StatusCount label="Low Risk" value={low} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
      </div>

      <Button variant="outline" onClick={downloadCsv} className="gap-2">
        <Download className="w-4 h-4" />
        Download CSV Report
      </Button>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Age / Gender</th>
              <th className="px-4 py-3">Risk Category</th>
              <th className="px-4 py-3">Risk Score</th>
              <th className="px-4 py-3">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={index} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium">{result.patientName}</td>
                <td className="px-4 py-3">
                  {result.age} / {result.gender}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-1 text-xs font-bold ${RISK_COLORS[result.riskCategory] || "bg-slate-100 text-slate-700"}`}>
                    {result.riskCategory}
                  </span>
                </td>
                <td className="px-4 py-3 font-bold">{result.riskScore}%</td>
                <td className="px-4 py-3 text-slate-500">
                  {result.confidenceInterval || result.modelConfidence ? (
                    <span title={`Model confidence: ${result.modelConfidence ?? "N/A"}`}>
                      {result.confidenceInterval || `${result.modelConfidence}%`}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ImportData() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const { step, progress, preview, results, fileName, error, parseFile, confirmImport, reset } = useBulkImport();
  const isProcessing = step === "parsing" || step === "validating" || step === "importing";

  const handleFile = (file: File | null) => {
    if (!file) return;
    const isCsv = file.name.endsWith(".csv");
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    if (!isCsv && !isExcel) {
      toast({ title: "Invalid file type", description: "Please upload a CSV or Excel (.xlsx, .xls) file.", variant: "destructive" });
      return;
    }
    parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFile(e.dataTransfer.files?.[0] ?? null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    handleFile(e.target.files?.[0] ?? null);
    if (e.target) e.target.value = "";
  };

  const handleConfirm = async () => {
    await confirmImport();
    toast({
      title: "Import complete",
      description: `Successfully imported ${results.length || "..."} patient record(s).`,
    });
  };

  return (
    <AppLayout>
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Bulk Import</h1>
        <p className="text-slate-500">
          Upload a CSV or Excel file with patient data. Each row is validated and processed through the ML risk model.
        </p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Upload Patient Data</CardTitle>
          <CardDescription>
            Supported formats: <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong>.
            Columns: patientName, gender, age, hypertension, heartDisease, smokingHistory, bmi, hba1cLevel, bloodGlucoseLevel.
            No records are saved until you confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "idle" || step === "error" ? (
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={handleDrop}
              className="relative flex h-56 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <input
                ref={inputRef}
                type="file"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                accept={ACCEPTED_TYPES}
                onChange={handleChange}
                disabled={isProcessing}
              />
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="rounded-full bg-white p-4 shadow-sm">
                  <FileSpreadsheet className="h-10 w-10 text-slate-500" />
                </div>
                <p className="text-lg font-bold text-slate-700">Click or drag a file here</p>
                <p className="text-sm text-slate-500">CSV, .xlsx, or .xls &middot; Max 5MB</p>
              </div>
            </div>
          ) : null}

          {(step === "parsing" || step === "validating" || step === "importing") && (
            <ProgressBar progress={progress} step={step} />
          )}

          {step === "error" && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <div>
                <p className="font-bold text-red-700">Import Error</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {step === "error" && (
            <Button variant="outline" onClick={reset}>Try Again</Button>
          )}
        </CardContent>
      </Card>

      {preview && step !== "idle" && step !== "parsing" && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Import Preview {fileName ? `- ${fileName}` : ""}
            </CardTitle>
            <CardDescription>
              Review valid and invalid rows before confirming the import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <StatusCount label="Valid" value={preview.validRows.length} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
              <StatusCount label="Invalid" value={preview.invalidRows.length} tone="border-red-200 bg-red-50 text-red-800" />
              <StatusCount label="Duplicates" value={preview.duplicateRows.length} tone="border-amber-200 bg-amber-50 text-amber-800" />
              <StatusCount label="Formula-like" value={preview.formulaRows.length} tone="border-slate-200 bg-slate-50 text-slate-800" />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                onClick={handleConfirm}
                disabled={isProcessing || preview.validRows.length === 0}
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Import {preview.validRows.length > 0 ? `(${preview.validRows.length})` : ""}
              </Button>
              <Button type="button" variant="outline" onClick={reset} disabled={isProcessing}>
                Cancel
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 max-h-80 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Row</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Age / Gender</th>
                    <th className="px-4 py-3">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3 font-medium">{row.rowNumber}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-1 text-xs font-bold ${row.status === "valid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {row.status === "valid" ? "Valid" : "Invalid"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{row.data?.patientName || String(row.raw.patientName || row.raw.name || "N/A")}</td>
                      <td className="px-4 py-3">
                        {row.data ? `${row.data.age} / ${row.data.gender}` : "N/A"}
                      </td>
                      <td className="max-w-md px-4 py-3 text-slate-700">
                        <RowIssues row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && results.length > 0 && (
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Import Successful — {results.length} Patient(s)
            </CardTitle>
            <CardDescription>
              All records have been processed and saved. You can download the results as a CSV report.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResultsSummary results={results} />
          </CardContent>
        </Card>
      )}

      {step === "done" && results.length > 0 && (
        <Button variant="outline" onClick={reset}>
          Import Another File
        </Button>
      )}
    </div>
    </AppLayout>
  );
}
