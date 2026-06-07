import { useState } from "react";
import Papa from "papaparse";
import { AlertCircle, CheckCircle, Loader2, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/apiClient";
import {
  buildCsvImportPreview,
  type ImportPreviewRow,
  type ImportPreviewSummary,
} from "@/utils/csvImportPreview";

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

export default function ImportData() {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [preview, setPreview] = useState<ImportPreviewSummary | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  const resetPreview = () => {
    setPreview(null);
    setSelectedFileName("");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(e.type === "dragenter" || e.type === "dragover");
  };

  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — matches server-side multer limit

  const processFile = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a valid CSV file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        title: "File too large",
        description: "Please upload a CSV file under 5 MB.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setPreview(null);
    setSelectedFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Record<string, unknown>>) => {
        const nextPreview = buildCsvImportPreview(results.data);
        setPreview(nextPreview);
        setIsProcessing(false);

        toast({
          title: "Preview ready",
          description: `${nextPreview.validRows.length} valid row(s), ${nextPreview.invalidRows.length} invalid row(s). Review before importing.`,
          variant: nextPreview.validRows.length === 0 ? "destructive" : "default",
        });
      },
      error: (error: Error) => {
        setIsProcessing(false);
        toast({
          title: "Parsing Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const confirmImport = async () => {
    if (!preview || preview.validRows.length === 0) {
      toast({
        title: "No valid rows",
        description: "Import is blocked until at least one row passes validation.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const assessments = preview.validRows.map((row) => row.data);
      const data = await ApiClient.post("/api/assessments/bulk", { assessments });
      setResults(data.assessments);
      toast({
        title: "Import complete",
        description: `Successfully imported ${data.count} patient record(s).`,
      });
      resetPreview();
    } catch (error: any) {
      toast({
        title: "Import Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) {
      processFile(e.target.files[0]);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Bulk Import</h1>
        <p className="text-slate-500">
          Upload a CSV file, review row-level validation, then confirm import for valid records.
        </p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Upload Patient Data</CardTitle>
          <CardDescription>
            CSV must contain patientName, gender, age, hypertension, heartDisease, smokingHistory, bmi, hba1cLevel,
            and bloodGlucoseLevel. No records are saved until you confirm the preview.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors
              ${isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"}
            `}
          >
            <input
              type="file"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              accept=".csv"
              onChange={handleChange}
              disabled={isProcessing}
            />

            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                <p className="font-semibold text-slate-600">Processing records...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="rounded-full bg-white p-4 shadow-sm">
                  <UploadCloud className="h-10 w-10 text-slate-500" />
                </div>
                <p className="text-lg font-bold text-slate-700">Click or drag CSV file to preview</p>
                <p className="text-sm text-slate-500">Max file size: 5MB</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              Import Preview {selectedFileName ? `- ${selectedFileName}` : ""}
            </CardTitle>
            <CardDescription>
              Review valid rows, invalid rows, duplicate warnings, and neutralized formula-like values before import.
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
              <Button onClick={confirmImport} disabled={isProcessing || preview.validRows.length === 0}>
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Import {preview.validRows.length > 0 ? `(${preview.validRows.length})` : ""}
              </Button>
              <Button type="button" variant="outline" onClick={resetPreview} disabled={isProcessing}>
                Cancel Preview
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">CSV Row</th>
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
                        <span
                          className={`rounded px-2 py-1 text-xs font-bold ${
                            row.status === "valid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          }`}
                        >
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

      {results.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Import Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Age/Gender</th>
                    <th className="px-4 py-3">Risk Category</th>
                    <th className="px-4 py-3">Risk Score</th>
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
                        <span
                          className={`rounded px-2 py-1 text-xs font-bold ${
                            result.riskCategory === "HIGH"
                              ? "bg-red-100 text-red-700"
                              : result.riskCategory === "MODERATE"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {result.riskCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold">{result.riskScore}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
