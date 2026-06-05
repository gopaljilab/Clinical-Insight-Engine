import { useState } from "react";
import Papa from "papaparse";
import { UploadCloud, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ApiClient } from "@/lib/apiClient";

export default function ImportData() {
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const processFile = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a valid CSV file.",
        variant: "destructive"
      });
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setIsProcessing(true);
        try {
          // Format headers to match expected schema if necessary
          const formattedData = results.data.map((row: any) => ({
            patientName: row.patientName || row.name || "Unknown Patient",
            gender: row.gender,
            age: Number(row.age),
            hypertension: row.hypertension === '1' || row.hypertension === 'true' || row.hypertension === true,
            heartDisease: row.heartDisease === '1' || row.heartDisease === 'true' || row.heartDisease === true,
            smokingHistory: row.smokingHistory || row.smoking_history,
            bmi: Number(row.bmi),
            hba1cLevel: Number(row.hba1cLevel || row.HbA1c_level),
            bloodGlucoseLevel: Number(row.bloodGlucoseLevel || row.blood_glucose_level)
          }));

          const data = await ApiClient.post("/api/assessments/bulk", { assessments: formattedData });
          setResults(data.assessments);
          toast({
            title: "Success",
            description: `Successfully imported ${data.count} patient records.`,
          });
        } catch (error: any) {
          toast({
            title: "Import Error",
            description: error.message,
            variant: "destructive"
          });
        } finally {
          setIsProcessing(false);
        }
      },
      error: (error) => {
        toast({
          title: "Parsing Error",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Bulk Import</h1>
        <p className="text-slate-500">Upload a CSV file to process multiple patient risk assessments at once.</p>
      </div>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Upload Patient Data</CardTitle>
          <CardDescription>
            CSV must contain headers: patientName, gender, age, hypertension, heartDisease, smokingHistory, bmi, hba1cLevel, bloodGlucoseLevel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl cursor-pointer transition-colors
              ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}
            `}
          >
            <input 
              type="file" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              accept=".csv"
              onChange={handleChange}
              disabled={isProcessing}
            />
            
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="font-semibold text-slate-600">Processing records...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-white rounded-full shadow-sm">
                  <UploadCloud className="w-10 h-10 text-slate-500" />
                </div>
                <p className="text-lg font-bold text-slate-700">Click or drag CSV file to upload</p>
                <p className="text-sm text-slate-500">Max file size: 5MB</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Import Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                  <tr>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Age/Gender</th>
                    <th className="px-4 py-3">Risk Category</th>
                    <th className="px-4 py-3">Risk Score</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-medium">{r.patientName}</td>
                      <td className="px-4 py-3">{r.age} / {r.gender}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          r.riskCategory === 'HIGH' ? 'bg-red-100 text-red-700' :
                          r.riskCategory === 'MODERATE' ? 'bg-amber-100 text-amber-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {r.riskCategory}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold">{r.riskScore}%</td>
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
