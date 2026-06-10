import { useState, useRef } from "react";
import Papa from "papaparse";
import { UploadCloud, CheckCircle, AlertCircle, Loader2, FileText, Download, X } from "lucide-react";
import { ApiClient } from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";

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


const REQUIRED_HEADERS = [
  "patientName","gender","age","hypertension",
  "heartDisease","smokingHistory","bmi","hba1cLevel","bloodGlucoseLevel",
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
  a.href = url; a.download = "sample_patient_data.csv"; a.click();
  URL.revokeObjectURL(url);
}
type ValidationResult =
  | { ok: true; count: number }
  | { ok: false; errors: string[] };

function validateParsedData(rows: any[]): ValidationResult {
  const errors: string[] = [];
  rows.forEach((row, i) => {
    const rowNum = i + 2;
    if (!row.patientName && !row.name) errors.push("Row " + rowNum + ": missing patientName");
    const age = Number(row.age);
    if (isNaN(age) || age <= 0) errors.push("Row " + rowNum + ": invalid age");
    const bmi = Number(row.bmi);
    if (isNaN(bmi) || bmi <= 0) errors.push("Row " + rowNum + ": invalid bmi");
    const hba1c = Number(row.hba1cLevel || row.HbA1c_level);
    if (isNaN(hba1c) || hba1c <= 0) errors.push("Row " + rowNum + ": missing hba1cLevel");
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, count: rows.length };
}

export default function ImportData() {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else if (e.type === "dragleave") setIsDragging(false);
  };

  const startProgress = () => {
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 15;
      if (p >= 90) { clearInterval(iv); p = 90; }
      setProgress(Math.min(p, 90));
    }, 180);
    return iv;
  };

  const clearFile = () => {
    setSelectedFile(null); setValidation(null); setResults([]); setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const formatBytes = (b: number) => b < 1024 ? b+" B" : b < 1048576 ? (b/1024).toFixed(1)+" KB" : (b/1048576).toFixed(1)+" MB";

  const processFile = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      toast({ title: "Invalid file type", description: "Please upload a valid CSV file.", variant: "destructive" });
      return;
    }
    setSelectedFile(file); setValidation(null); setResults([]);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (parsed: Papa.ParseResult<any>) => {
        const v = validateParsedData(parsed.data);
        setValidation(v);
        if (!v.ok) return;
        setIsProcessing(true);
        const iv = startProgress();
        try {
          const formattedData = parsed.data.map((row: any) => ({
            patientName: row.patientName || row.name || "Unknown Patient",
            gender: row.gender, age: Number(row.age),
            hypertension: row.hypertension === "1" || row.hypertension === "true" || row.hypertension === true,
            heartDisease: row.heartDisease === "1" || row.heartDisease === "true" || row.heartDisease === true,
            smokingHistory: row.smokingHistory || row.smoking_history,
            bmi: Number(row.bmi),
            hba1cLevel: Number(row.hba1cLevel || row.HbA1c_level),
            bloodGlucoseLevel: Number(row.bloodGlucoseLevel || row.blood_glucose_level),
          }));
          const res = await fetch("/api/assessments/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ assessments: formattedData }) });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Import failed");
          clearInterval(iv); setProgress(100); setResults(data.assessments);
          toast({ title: "Success", description: "Successfully imported " + data.count + " patient records." });
        } catch (error: any) {
          clearInterval(iv); setProgress(0);
          toast({ title: "Import Error", description: error.message, variant: "destructive" });
        } finally { setIsProcessing(false); }
      },
      error: (error: Error) => { toast({ title: "Parsing Error", description: error.message, variant: "destructive" }); },
    });
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    const isCsv = file.name.endsWith(".csv");
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    if (!isCsv && !isExcel) {
      toast({ title: "Invalid file type", description: "Please upload a CSV or Excel (.xlsx, .xls) file.", variant: "destructive" });
      return;
    }
    processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) processFile(e.target.files[0]);
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
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Upload Patient Data</CardTitle>
            <CardDescription className="mt-1">CSV must contain headers: {REQUIRED_HEADERS.join(", ")}.</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={downloadSampleCSV}>
            <Download className="w-4 h-4" /> Download Sample CSV Template
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {!selectedFile && (
            <div onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={"relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 " + (isDragging ? "border-blue-500 bg-blue-50 scale-[1.01]" : "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400")}>
              <input ref={inputRef} type="file" className="hidden" accept=".csv" onChange={handleChange} disabled={isProcessing} />
              <div className={"flex flex-col items-center gap-3 transition-transform duration-300 " + (isDragging ? "translate-y-[-4px]" : "")}>
                <div className={"p-4 rounded-full shadow-sm transition-colors " + (isDragging ? "bg-blue-100" : "bg-white")}>
                  <UploadCloud className={"w-10 h-10 transition-colors " + (isDragging ? "text-blue-500" : "text-slate-400")} />
                </div>
                <p className="text-lg font-bold text-slate-700">{isDragging ? "Drop your CSV file here" : "Click or drag CSV file to upload"}</p>
                <p className="text-sm text-slate-500">Max file size: 5 MB</p>
              </div>
            </div>
          )}

          {selectedFile && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg"><FileText className="w-6 h-6 text-blue-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
                </div>
                {!isProcessing && <button onClick={clearFile} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-4 h-4" /></button>}
              </div>
              {(isProcessing || progress > 0) && (
                <div className="space-y-1">
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full transition-all duration-300" style={{ width: progress+"%", background: progress === 100 ? "linear-gradient(90deg,#10b981,#059669)" : "linear-gradient(90deg,#3b82f6,#6366f1)" }} />
                  </div>
                  <p className="text-xs text-slate-500">{isProcessing ? (progress < 90 ? "Parsing and validating recordsâ¦" : "Uploading to serverâ¦") : "Complete"}</p>
                </div>
              )}
              {!isProcessing && validation?.ok && progress < 100 && (
                <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => processFile(selectedFile)}>
                  <UploadCloud className="w-4 h-4" /> Process Data
                </Button>
              )}
            </div>
          )}

          {validation && (
            <div className={"rounded-xl border p-4 " + (validation.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")}>
              {validation.ok ? (
                <div className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" /><p className="font-semibold text-emerald-800">CSV Validated: {(validation as any).count} patient records ready for optimization mapping.</p></div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500 shrink-0" /><p className="font-semibold text-red-800">Validation Failed: {(validation as any).errors.length} issue(s) found.</p></div>
                  <ul className="ml-7 space-y-1">{(validation as any).errors.slice(0,8).map((err: string, i: number) => <li key={i} className="text-sm text-red-700 list-disc">{err}</li>)}</ul>
                  <Button variant="outline" size="sm" onClick={clearFile}><X className="w-3 h-3 mr-1" />Clear and re-upload</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-emerald-500" />Import Successful -- {results.length} records processed</CardTitle></CardHeader>
          <CardContent><div className="overflow-x-auto"><table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50"><tr><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Age / Gender</th><th className="px-4 py-3">Risk Category</th><th className="px-4 py-3">Risk Score</th></tr></thead>
            <tbody>{results.map((r, i) => (<tr key={i} className="border-b border-slate-100"><td className="px-4 py-3 font-medium">{r.patientName}</td><td className="px-4 py-3">{r.age} / {r.gender}</td><td className="px-4 py-3"><span className={"px-2 py-1 rounded text-xs font-bold " + (r.riskCategory === "HIGH" ? "bg-red-100 text-red-700" : r.riskCategory === "MODERATE" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>{r.riskCategory}</span></td><td className="px-4 py-3 font-bold">{r.riskScore}%</td></tr>))}</tbody>
          </table></div></CardContent>
        </Card>
      )}

      {results.length > 0 && !isProcessing && (
        <Button variant="outline" onClick={clearFile}>
          Import Another File
        </Button>
      )}
    </div>
    </AppLayout>
  );
}
