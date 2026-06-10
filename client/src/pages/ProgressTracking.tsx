import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { Search, TrendingUp, Activity, Weight, HeartPulse, Loader2, AlertCircle } from "lucide-react";

interface Assessment {
  id: number;
  patientName: string;
  gender: string;
  age: number;
  bmi: number;
  hba1cLevel: number;
  bloodGlucoseLevel: number;
  riskScore: number;
  riskCategory: string;
  createdAt: string;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
  } catch { return dateStr; }
}

function formatDateFull(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return dateStr; }
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

const HBA1C_REFERENCE_LINES = [
  { value: 5.7, label: "Normal threshold (5.7%)", color: "#16a34a" },
  { value: 6.5, label: "Diabetes threshold (6.5%)", color: "#dc2626" },
];

const GLUCOSE_REFERENCE_LINES = [
  { value: 100, label: "Normal fasting (100)", color: "#16a34a" },
  { value: 126, label: "Diabetes threshold (126)", color: "#dc2626" },
];

const BMI_REFERENCE_LINES = [
  { value: 18.5, label: "Underweight (18.5)", color: "#ca8a04" },
  { value: 25, label: "Overweight (25)", color: "#ca8a04" },
  { value: 30, label: "Obese (30)", color: "#dc2626" },
];

const RISK_BANDS = [
  { min: 0, max: 25, color: "#16a34a", label: "LOW" },
  { min: 25, max: 50, color: "#d97706", label: "MODERATE" },
  { min: 50, max: 100, color: "#dc2626", label: "HIGH" },
];

function riskColor(category: string): string {
  switch (category) {
    case "HIGH": return "text-red-700 bg-red-100";
    case "MODERATE": return "text-amber-700 bg-amber-100";
    default: return "text-green-700 bg-green-100";
  }
}

export default function ProgressTracking() {
  const [searchQuery, setSearchQuery] = useState("");
  const [patientName, setPatientName] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPatients = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/assessments/search?q=${encodeURIComponent(q)}&limit=10`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const names = [...new Set<string>((data.data ?? []).map((a: any) => a.patientName as string))];
      setSuggestions(names);
    } catch { setSuggestions([]); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchPatients(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchPatients]);

  async function loadPatient(name: string) {
    setPatientName(name);
    setSearchQuery(name);
    setSuggestions([]);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assessments/patient/${encodeURIComponent(name)}/trends`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load patient data");
      const data = await res.json();
      setAssessments(data.data ?? []);
    } catch (err: any) {
      setError(err.message || "Failed to load patient data");
    } finally {
      setLoading(false);
    }
  }

  const chartData = [...assessments]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((a) => ({
      ...a,
      date: formatDate(a.createdAt),
      dateFull: formatDateFull(a.createdAt),
    }));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">Patient Progress Tracking</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Select a patient to view historical biomarker and risk score trends.
          </p>
        </div>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg">Search Patient</CardTitle>
            <CardDescription>Type a patient name to view their progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search patient name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.trim()) loadPatient(searchQuery.trim()); }}
                className="pl-10"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {suggestions.map((name) => (
                    <button
                      key={name}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 first:rounded-t-xl last:rounded-b-xl"
                      onClick={() => loadPatient(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        )}

        {!loading && patientName && chartData.length === 0 && !error && (
          <Card className="border-slate-200 dark:border-slate-700">
            <CardContent className="py-12 text-center text-slate-500">
              No assessment records found for <strong>{patientName}</strong>.
            </CardContent>
          </Card>
        )}

        {chartData.length > 0 && (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <HeartPulse className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">{patientName}</p>
                <p className="text-xs text-slate-500">{chartData.length} assessment{chartData.length !== 1 ? "s" : ""} recorded</p>
              </div>
            </div>

            <div className="grid gap-6">
              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">HbA1c Trend</CardTitle>
                  </div>
                  <CardDescription>HbA1c over time with clinical thresholds</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis domain={[3, 15]} tick={{ fontSize: 12 }} label={{ value: "HbA1c (%)", angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                        <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.dateFull ?? ""} />
                        <Legend />
                        {HBA1C_REFERENCE_LINES.map((rl) => (
                          <ReferenceLine key={rl.label} y={rl.value} stroke={rl.color} strokeDasharray="4 4" label={{ value: rl.label, position: "right", style: { fontSize: 10, fill: rl.color } }} />
                        ))}
                        <Line type="monotone" dataKey="hba1cLevel" stroke="#2563eb" strokeWidth={2} dot={{ r: 4, fill: "#2563eb" }} name="HbA1c" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-orange-600" />
                    <CardTitle className="text-lg">Blood Glucose Trend</CardTitle>
                  </div>
                  <CardDescription>Blood glucose over time with clinical thresholds</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis domain={[50, 300]} tick={{ fontSize: 12 }} label={{ value: "mg/dL", angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                        <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.dateFull ?? ""} />
                        <Legend />
                        {GLUCOSE_REFERENCE_LINES.map((rl) => (
                          <ReferenceLine key={rl.label} y={rl.value} stroke={rl.color} strokeDasharray="4 4" label={{ value: rl.label, position: "right", style: { fontSize: 10, fill: rl.color } }} />
                        ))}
                        <Line type="monotone" dataKey="bloodGlucoseLevel" stroke="#ea580c" strokeWidth={2} dot={{ r: 4, fill: "#ea580c" }} name="Blood Glucose" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Weight className="h-5 w-5 text-emerald-600" />
                    <CardTitle className="text-lg">BMI Trajectory</CardTitle>
                  </div>
                  <CardDescription>BMI over time with weight classification thresholds</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis domain={[10, 50]} tick={{ fontSize: 12 }} label={{ value: "BMI", angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                        <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.dateFull ?? ""} />
                        <Legend />
                        {BMI_REFERENCE_LINES.map((rl) => (
                          <ReferenceLine key={rl.label} y={rl.value} stroke={rl.color} strokeDasharray="4 4" label={{ value: rl.label, position: "right", style: { fontSize: 10, fill: rl.color } }} />
                        ))}
                        <Line type="monotone" dataKey="bmi" stroke="#059669" strokeWidth={2} dot={{ r: 4, fill: "#059669" }} name="BMI" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <CardTitle className="text-lg">Risk Score History</CardTitle>
                  </div>
                  <CardDescription>Diabetes risk score over time with risk bands</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} label={{ value: "Risk Score (%)", angle: -90, position: "insideLeft", style: { fontSize: 12 } }} />
                        <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.dateFull ?? ""} formatter={(value: number) => [`${value.toFixed(1)}%`, "Risk Score"]} />
                        <Legend />
                        {RISK_BANDS.filter((b) => b.min > 0).map((b) => (
                          <ReferenceLine key={b.label} y={b.min} stroke={b.color} strokeDasharray="4 4" label={{ value: b.label, position: "right", style: { fontSize: 10, fill: b.color } }} />
                        ))}
                        <Line type="monotone" dataKey="riskScore" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4, fill: "#7c3aed" }} name="Risk Score" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg">Assessment History</CardTitle>
                  <CardDescription>All recorded assessments for {patientName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs uppercase bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3 rounded-l-xl">Date</th>
                          <th className="px-4 py-3">Age</th>
                          <th className="px-4 py-3">BMI</th>
                          <th className="px-4 py-3">HbA1c</th>
                          <th className="px-4 py-3">Glucose</th>
                          <th className="px-4 py-3">Risk Score</th>
                          <th className="px-4 py-3 rounded-r-xl">Category</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...assessments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((a) => (
                          <tr key={a.id} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-4 py-3 whitespace-nowrap">{formatDateFull(a.createdAt)}</td>
                            <td className="px-4 py-3">{a.age}</td>
                            <td className="px-4 py-3">{a.bmi.toFixed(1)}</td>
                            <td className="px-4 py-3">{a.hba1cLevel.toFixed(1)}%</td>
                            <td className="px-4 py-3">{a.bloodGlucoseLevel}</td>
                            <td className="px-4 py-3 font-medium">{a.riskScore.toFixed(1)}%</td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex px-2 py-1 rounded-full text-xs font-semibold", riskColor(a.riskCategory))}>
                                {a.riskCategory}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
