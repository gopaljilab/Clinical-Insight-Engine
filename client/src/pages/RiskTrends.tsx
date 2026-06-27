import { useState, useCallback, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Search, TrendingUp, TrendingDown, Minus, Activity,
  HeartPulse, Loader2, AlertCircle, Calendar,
} from "lucide-react";
import { formatCompactDate, formatReadableDate } from "@/utils/dateFormat";
import { ApiClient } from "@/lib/apiClient";

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
  hypertension: boolean;
  heartDisease: boolean;
  smokingHistory: string;
  createdAt: string;
}

interface Summary {
  total: number;
  latestRiskScore: number | null;
  latestRiskCategory: string | null;
  earliestRiskScore: number | null;
  trend: "improving" | "stable" | "worsening";
  avgRiskScore: number;
  change: number;
}

interface DashboardData {
  assessments: Assessment[];
  summary: Summary;
}

const RISK_COLORS = {
  LOW: "#10b981",
  MODERATE: "#f59e0b",
  HIGH: "#ef4444",
};

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function TrendBadge({ trend }: { trend: string }) {
  if (trend === "improving") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-950/40 px-2.5 py-0.5 text-xs font-bold text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900"><TrendingDown className="w-3.5 h-3.5" /> Improving</span>;
  }
  if (trend === "worsening") {
    return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/40 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900"><TrendingUp className="w-3.5 h-3.5" /> Worsening</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"><Minus className="w-3.5 h-3.5" /> Stable</span>;
}

export default function RiskTrends() {
  const [searchQuery, setSearchQuery] = useState("");
  const [patientName, setPatientName] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const names = await ApiClient.get<string[]>(`/api/assessments/autocomplete?q=${encodeURIComponent(q)}`);
      setSuggestions(names);
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, fetchSuggestions]);

  const loadDashboard = useCallback(async (name: string, sd: string, ed: string) => {
    setPatientName(name);
    setSearchQuery(name);
    setSuggestions([]);
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ patientName: name });
      if (sd) params.set("startDate", sd);
      if (ed) params.set("endDate", ed);
      const json = await ApiClient.get(`/api/assessments/trends/dashboard?${params.toString()}`);
      setData(json as any);
    } catch (err: any) {
      setError(err.message || "Failed to load trends data");
    } finally {
      setLoading(false);
    }
  }, []);

  const chartData = (data?.assessments ?? []).map((a) => ({
    ...a,
    date: formatCompactDate(a.createdAt, ""),
    dateFull: formatReadableDate(a.createdAt, { includeTime: false, fallback: "Unknown" }),
  }));

  const s = data?.summary;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Longitudinal Risk Trends</h1>
          <p className="text-muted-foreground">Track diabetes risk score changes over time for any patient.</p>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Select Patient</CardTitle>
            <CardDescription>Search and select a patient to view their risk trajectory</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Search patient name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.trim()) loadDashboard(searchQuery.trim(), startDate, endDate); }}
                  className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {suggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card shadow-lg">
                    {suggestions.map((name) => (
                      <button
                        key={name}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted first:rounded-t-xl last:rounded-b-xl"
                        onClick={() => loadDashboard(name, startDate, endDate)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">From</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">To</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="h-10 rounded-xl border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <button onClick={() => patientName && loadDashboard(patientName, startDate, endDate)}
                  className="flex items-center gap-1.5 h-10 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Calendar className="w-4 h-4" /> Apply
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && patientName && !data && !error && (
          <Card className="border-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              No assessment records found for <strong>{patientName}</strong>.
            </CardContent>
          </Card>
        )}

        {data && s && (
          <>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <HeartPulse className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{patientName}</p>
                  <p className="text-xs text-muted-foreground">{s.total} assessment{s.total !== 1 ? "s" : ""} recorded</p>
                </div>
              </div>
              <TrendBadge trend={s.trend} />
            </div>

            <div className="grid gap-6 md:grid-cols-4">
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Latest Risk Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-black ${s.latestRiskCategory === "HIGH" ? "text-red-500" : s.latestRiskCategory === "MODERATE" ? "text-amber-500" : "text-green-500"}`}>
                    {s.latestRiskScore != null ? `${s.latestRiskScore.toFixed(1)}%` : "N/A"}
                  </div>
                  {s.latestRiskCategory && (
                    <span className={cn(
                      "inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                      s.latestRiskCategory === "HIGH" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" :
                      s.latestRiskCategory === "MODERATE" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                      "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                    )}>{s.latestRiskCategory}</span>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Average Risk</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black text-foreground">{s.avgRiskScore}%</div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Change</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-black ${s.change < 0 ? "text-green-500" : s.change > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {s.change > 0 ? "+" : ""}{s.change}%
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Direction</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black text-foreground">
                    {s.trend === "improving" ? <TrendingDown className="h-8 w-8 text-green-500" /> :
                     s.trend === "worsening" ? <TrendingUp className="h-8 w-8 text-red-500" /> :
                     <Minus className="h-8 w-8 text-muted-foreground" />}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border shadow-sm bg-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-purple-500" />
                  <CardTitle className="text-foreground">Risk Score Trend</CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">Diabetes risk score over time with risk bands</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  {chartData.length >= 2 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Risk Score (%)", angle: -90, position: "insideLeft", style: { fontSize: 12, fill: "hsl(var(--muted-foreground))" } }} />
                        <Tooltip
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.dateFull ?? ""}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, "Risk Score"]}
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", color: "hsl(var(--card-foreground))" }}
                        />
                        <Legend wrapperStyle={{ color: "hsl(var(--foreground))" }} />
                        <ReferenceLine y={50} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "High Risk", position: "right", style: { fontSize: 10, fill: "#ef4444" } }} />
                        <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Moderate", position: "right", style: { fontSize: 10, fill: "#f59e0b" } }} />
                        <Line type="monotone" dataKey="riskScore" stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 5, fill: "#7c3aed", stroke: "white", strokeWidth: 2 }} activeDot={{ r: 7 }} name="Risk Score" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                      At least 2 assessments are needed to display a trend line.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-border shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground">HbA1c Trend</CardTitle>
                  <CardDescription className="text-muted-foreground">HbA1c over time with clinical thresholds</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {chartData.length >= 2 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis domain={[3, 15]} tick={{ fontSize: 11 }} />
                          <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.dateFull ?? ""} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                          <ReferenceLine y={5.7} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "Normal (5.7%)", fontSize: 10, fill: "#16a34a" }} />
                          <ReferenceLine y={6.5} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "Diabetes (6.5%)", fontSize: 10, fill: "#dc2626" }} />
                          <Line type="monotone" dataKey="hba1cLevel" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} name="HbA1c" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Insufficient data</div>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground">Blood Glucose Trend</CardTitle>
                  <CardDescription className="text-muted-foreground">Glucose over time with clinical thresholds</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    {chartData.length >= 2 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis domain={[50, 300]} tick={{ fontSize: 11 }} />
                          <Tooltip labelFormatter={(_, payload) => payload?.[0]?.payload?.dateFull ?? ""} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                          <ReferenceLine y={100} stroke="#16a34a" strokeDasharray="4 4" label={{ value: "Normal (100)", fontSize: 10, fill: "#16a34a" }} />
                          <ReferenceLine y={126} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "Diabetes (126)", fontSize: 10, fill: "#dc2626" }} />
                          <Line type="monotone" dataKey="bloodGlucoseLevel" stroke="#ea580c" strokeWidth={2} dot={{ r: 4 }} name="Glucose" />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Insufficient data</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border shadow-sm bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Assessment History</CardTitle>
                <CardDescription className="text-muted-foreground">All recorded assessments for {patientName}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted text-muted-foreground">
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
                      {[...(data?.assessments ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((a) => (
                        <tr key={a.id} className="border-b border-border">
                          <td className="px-4 py-3 whitespace-nowrap">{formatReadableDate(a.createdAt, { includeTime: false })}</td>
                          <td className="px-4 py-3">{a.age}</td>
                          <td className="px-4 py-3">{a.bmi.toFixed(1)}</td>
                          <td className="px-4 py-3">{a.hba1cLevel.toFixed(1)}%</td>
                          <td className="px-4 py-3">{a.bloodGlucoseLevel}</td>
                          <td className="px-4 py-3 font-medium">{a.riskScore.toFixed(1)}%</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex px-2 py-1 rounded-full text-xs font-semibold",
                              a.riskCategory === "HIGH" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" :
                              a.riskCategory === "MODERATE" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                              "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                            )}>{a.riskCategory}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
