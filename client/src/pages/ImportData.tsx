import { useState, useRef } from "react";
import { useBulkImport } from "@/hooks/use-bulk-import";
import {
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  Download,
  X,
  XCircle,
  AlertTriangle,
  Play,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const REQUIRED_HEADERS = [
  "patientName",
  "gender",
  "age",
  "hypertension",
  "heartDisease",
  "smokingHistory",
  "bmi",
  "hba1cLevel",
  "bloodGlucoseLevel",
];

const SAMPLE_CSV_ROWS = [
  REQUIRED_HEADERS.join(","),
  "John Doe,male,45,0,0,never,28.5,5.7,140",
  "Jane Smith,female,62,1,0,current,32.1,7.2,210",
];

function downloadSampleCSV() {
  const blob = new Blob([SAMPLE_CSV_ROWS.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample_patient_data.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportData() {
  const {
    step,
    progress,
    preview,
    results,
    fileName,
    error,
    completedRows,
    failedRows,
    totalRows,
    eta,
    hasInterruptedSession,
    parseFile,
    confirmImport,
    cancel,
    resume,
    discardSession,
    reset,
  } = useBulkImport();

  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else if (e.type === "dragleave") setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    const isCsv = file.name.endsWith(".csv");
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    if (!isCsv && !isExcel) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel (.xlsx, .xls) file.",
        variant: "destructive",
      });
      return;
    }
    parseFile(file);
  };

  const handleProcessData = async () => {
    if (!preview || preview.validRows.length === 0) return;

    setCheckingDuplicates(true);
    try {
      const validRowsData = preview.validRows.map((r) => r.data);
      const res = await fetch("/api/assessments/check-duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessments: validRowsData }),
      });

      if (!res.ok) {
        throw new Error("Failed to check duplicate records.");
      }

      const data = await res.json();
      if (data.duplicates && data.duplicates.length > 0) {
        setDuplicateMatches(data.duplicates);
        setShowDuplicateDialog(true);
      } else {
        await confirmImport();
      }
    } catch (err: any) {
      toast({
        title: "Duplicate Check Error",
        description: err.message || "Could not check duplicates. Proceeding directly.",
        variant: "destructive",
      });
      await confirmImport();
    } finally {
      setCheckingDuplicates(false);
    }
  };

  const clearFile = () => {
    reset();
    if (inputRef.current) inputRef.current.value = "";
  };

  const formatBytes = (b: number) =>
    b < 1024
      ? b + " B"
      : b < 1048576
      ? (b / 1024).toFixed(1) + " KB"
      : (b / 1048576).toFixed(1) + " MB";

  const formatEta = (seconds: number | null) => {
    if (seconds === null) return "Calculating...";
    if (seconds === 0) return "Almost done";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s remaining` : `${secs}s remaining`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-gray-100">
            Bulk Import
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Upload a CSV or Excel file with patient data. Each row is validated and processed in
            batches through the ML risk model.
          </p>
        </div>

        {/* Resume Interrupted Session Dialog */}
        <AlertDialog open={hasInterruptedSession}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                Interrupted Import Detected
              </AlertDialogTitle>
              <AlertDialogDescription>
                An unfinished import session for <strong>{fileName}</strong> was found in local storage (
                {completedRows} row(s) completed). Would you like to resume importing the remaining
                data or discard this session?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={discardSession}>
                Discard Session
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={resume}>
                Resume Import
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Duplicate Matches Warning Dialog */}
        <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
                Duplicate Records Detected
              </AlertDialogTitle>
              <AlertDialogDescription>
                We found {duplicateMatches.length} patient record(s) already in the database with
                the same name, age, and gender. Choose how to handle duplicates:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ScrollArea className="max-h-48 border border-slate-200 dark:border-gray-800 rounded-lg p-3 my-2 bg-slate-50 dark:bg-slate-950/50">
              {duplicateMatches.map((dup, i) => (
                <div key={i} className="text-xs text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-gray-900 py-1.5 last:border-0 last:pb-0">
                  Patient: <span className="font-semibold text-slate-800 dark:text-slate-200">{dup.patientName}</span> ({dup.gender}, Age: {dup.age})
                </div>
              ))}
            </ScrollArea>
            <AlertDialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="outline"
                className="border-amber-600 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                onClick={async () => {
                  setShowDuplicateDialog(false);
                  await confirmImport(duplicateMatches);
                }}
              >
                Skip Duplicates
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={async () => {
                  setShowDuplicateDialog(false);
                  await confirmImport();
                }}
              >
                Import All Anyway
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Card className="border-slate-200 dark:border-gray-700 shadow-lg">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold dark:text-gray-100">Upload Patient Data</CardTitle>
              <CardDescription className="mt-1">
                CSV or Excel must contain headers: {REQUIRED_HEADERS.join(", ")}.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-2 hover:bg-slate-50 dark:hover:bg-gray-800"
              onClick={downloadSampleCSV}
            >
              <Download className="w-4 h-4" /> Download Sample CSV
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === "idle" && (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={
                  "relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 " +
                  (isDragging
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.01] shadow-md shadow-blue-500/10"
                    : "border-slate-300 dark:border-gray-600 bg-slate-50/50 dark:bg-gray-800/20 hover:bg-slate-100/50 dark:hover:bg-gray-800/40 hover:border-slate-400 dark:hover:border-gray-500")
                }
              >
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleChange}
                />
                <div
                  className={
                    "flex flex-col items-center gap-3 transition-transform duration-300 " +
                    (isDragging ? "scale-[1.03]" : "")
                  }
                >
                  <div className="p-4 rounded-full bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 shadow-sm">
                    <UploadCloud className="w-10 h-10 text-blue-500 dark:text-blue-400" />
                  </div>
                  <p className="text-lg font-bold text-slate-700 dark:text-gray-200">
                    {isDragging ? "Drop your data file here" : "Click or drag file to upload"}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Supports CSV or Excel up to 5 MB
                  </p>
                </div>
              </div>
            )}

            {/* Parsing, Validating or Importing State Details */}
            {step !== "idle" && (
              <div className="rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-4 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-100 dark:border-blue-900/50">
                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 dark:text-gray-200 truncate">
                      {fileName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {preview?.validRows ? `${preview.validRows.length} valid rows found` : "Analyzing file..."}
                    </p>
                  </div>
                  {step !== "importing" && (
                    <button
                      onClick={clearFile}
                      className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-gray-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  )}
                </div>

                {/* Progress bar during import */}
                {step === "importing" && (
                  <div className="space-y-3 bg-slate-50 dark:bg-slate-950/30 p-4 rounded-xl border border-slate-100 dark:border-gray-800">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        Importing & analyzing ML models...
                      </span>
                      <span className="font-bold text-slate-800 dark:text-gray-100">
                        {progress}%
                      </span>
                    </div>

                    <Progress value={progress} className="h-2.5" />

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                      <div className="bg-white dark:bg-gray-900 p-2 rounded-lg border border-slate-100 dark:border-gray-800 text-center shadow-sm">
                        <p className="text-slate-400 dark:text-slate-500 font-medium">Completed</p>
                        <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{completedRows}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-2 rounded-lg border border-slate-100 dark:border-gray-800 text-center shadow-sm">
                        <p className="text-slate-400 dark:text-slate-500 font-medium">Failed</p>
                        <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">{failedRows}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-2 rounded-lg border border-slate-100 dark:border-gray-800 text-center shadow-sm">
                        <p className="text-slate-400 dark:text-slate-500 font-medium">Total Rows</p>
                        <p className="text-base font-bold text-slate-700 dark:text-slate-300 mt-0.5">{totalRows}</p>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-2 rounded-lg border border-slate-100 dark:border-gray-800 col-span-2 sm:col-span-1 flex flex-col justify-center text-center shadow-sm">
                        <p className="text-slate-400 dark:text-slate-500 font-medium">ETA</p>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate">
                          {formatEta(eta)}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="destructive"
                      className="w-full gap-2 mt-2"
                      onClick={cancel}
                    >
                      <XCircle className="w-4 h-4" /> Cancel Import
                    </Button>
                  </div>
                )}

                {/* Confirm Import button in validating stage */}
                {step === "validating" && preview && preview.validRows.length > 0 && (
                  <Button
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-5 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.99] transition-all"
                    onClick={handleProcessData}
                    disabled={checkingDuplicates}
                  >
                    {checkingDuplicates ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Checking Duplicates...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" /> Process & Import Data
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Validation alerts/errors summary */}
            {preview && (
              <div
                className={
                  "rounded-xl border p-4 shadow-sm " +
                  (preview.invalidRows.length === 0
                    ? "border-emerald-200 dark:border-emerald-950/50 bg-emerald-50/50 dark:bg-emerald-950/15"
                    : "border-amber-200 dark:border-amber-950/50 bg-amber-50/50 dark:bg-amber-950/15")
                }
              >
                {preview.invalidRows.length === 0 ? (
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="w-5.5 h-5.5 text-emerald-500 shrink-0" />
                    <p className="font-semibold text-emerald-800 dark:text-emerald-400 text-sm sm:text-base">
                      File Validated: {preview.validRows.length} patient records ready for processing.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-5.5 h-5.5 text-amber-500 shrink-0" />
                      <p className="font-semibold text-amber-800 dark:text-amber-400 text-sm sm:text-base">
                        Validation Review: {preview.invalidRows.length} row(s) contain validation
                        errors and will be skipped.
                      </p>
                    </div>
                    <ScrollArea className="max-h-40 border border-amber-100 dark:border-amber-950/50 rounded-lg p-3 bg-white dark:bg-slate-900/60">
                      <ul className="space-y-1.5 list-disc pl-4">
                        {preview.invalidRows.map((err, i) => (
                          <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                            Row {err.rowNumber}: {err.errors.join(", ")}
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                    <div className="text-xs text-slate-500 dark:text-slate-400 pl-1">
                      {preview.validRows.length} valid rows can still be imported.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error messaging */}
            {error && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-950/50 bg-rose-50/50 dark:bg-rose-950/15 p-4 flex gap-2.5">
                <XCircle className="w-5.5 h-5.5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-rose-800 dark:text-rose-400">Import Alert</h4>
                  <p className="text-sm text-rose-700 dark:text-rose-400 mt-1">{error}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results view after completion */}
        {step === "done" && results.length > 0 && (
          <Card className="border-slate-200 dark:border-gray-700 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2.5 dark:text-gray-100">
                <ShieldCheck className="w-6 h-6 text-emerald-500" />
                Import Successful — {results.length} Records Processed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-gray-800">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-gray-800/50 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Age / Gender</th>
                      <th className="px-4 py-3">Risk Category</th>
                      <th className="px-4 py-3 text-right">Risk Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-100 dark:border-gray-800 hover:bg-slate-50/50 dark:hover:bg-gray-800/20 transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-gray-200">
                          {r.patientName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {r.age} / {r.gender}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold " +
                              (r.riskCategory === "HIGH"
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                                : r.riskCategory === "MODERATE"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400")
                            }
                          >
                            {r.riskCategory}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold text-right text-slate-850 dark:text-gray-100">
                          {r.riskScore}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "done" && (
          <Button variant="outline" className="hover:bg-slate-50 dark:hover:bg-gray-800 shadow-sm" onClick={clearFile}>
            Import Another File
          </Button>
        )}
      </div>
    </AppLayout>
  );
}
