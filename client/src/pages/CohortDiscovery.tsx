import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, Activity, AlertTriangle, BarChart3, Download,
  Filter, X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ApiClient } from "@/lib/apiClient";

interface CohortData {
  riskDistribution: { category: string; count: number }[];
  ageDistribution: { range: string; count: number }[];
  genderDistribution: { gender: string; count: number }[];
  smokingDistribution: { history: string; count: number }[];
  total: number;
  avgRiskScore: number | string;
  avgBmi: number | string;
  avgHba1c: number | string;
  avgGlucose: number | string;
  comorbidityRate: number | string;
}

const COLORS = {
  LOW: "#10b981",
  MODERATE: "#f59e0b",
  HIGH: "#ef4444",
};

const AGE_COLORS = ["#6366f1", "#818cf8", "#a5b4fc", "#38bdf8", "#34d399", "#f472b6"];

const defaultFilters = {
  minAge: "", maxAge: "",
  minBmi: "", maxBmi: "",
  minHba1c: "", maxHba1c: "",
  minGlucose: "", maxGlucose: "",
  gender: "",
  smokingHistory: "",
  hypertension: "",
  heartDisease: "",
  riskCategory: "",
};

export default function CohortDiscovery() {
  const [filters, setFilters] = useState({ ...defaultFilters });
  const [applied, setApplied] = useState<Record<string, string>>({});

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(applied).forEach(([k, v]) => { if (v !== "" && v !== undefined && v !== null) p.set(k, v); });
    return p.toString();
  }, [applied]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/assessments/cohort", queryString],
    queryFn: async () => {
      if (!queryString) return null;
      return ApiClient.get(`/api/assessments/cohort?${queryString}`) as Promise<CohortData>;
    },
  });

  const handleApply = () => {
    const active: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== "" && v !== undefined && v !== null) active[k] = v;
    });
    setApplied(active);
  };

  const handleClear = () => {
    setFilters({ ...defaultFilters });
    setApplied({});
  };

  const activeFilterCount = Object.values(applied).filter((v) => v !== "").length;

  const riskDistData = useMemo(() => {
    if (!data?.riskDistribution) return [];
    return data.riskDistribution.map((d: any) => ({
      name: d.category,
      value: d.count,
      color: COLORS[d.category as keyof typeof COLORS] ?? "#94a3b8",
    }));
  }, [data]);

  const ageDistData = useMemo(() => {
    if (!data?.ageDistribution) return [];
    return data.ageDistribution.map((d: any, i: number) => ({
      name: d.range,
      count: d.count,
      color: AGE_COLORS[i % AGE_COLORS.length],
    }));
  }, [data]);

  const genderDistData = useMemo(() => {
    if (!data?.genderDistribution) return [];
    return data.genderDistribution.map((d: any) => ({ name: d.gender, value: d.count }));
  }, [data]);

  const smokingDistData = useMemo(() => {
    if (!data?.smokingDistribution) return [];
    return data.smokingDistribution.map((d: any) => ({ name: d.status, value: d.count }));
  }, [data]);

  const renderFilterInput = (label: string, key: string, type = "number", placeholder = "") => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={(filters as any)[key]}
        onChange={(e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }))}
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      />
    </div>
  );

  const renderSelect = (label: string, key: string, options: { value: string; label: string }[]) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <select
        value={(filters as any)[key]}
        onChange={(e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }))}
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
      >
        <option value="">Any</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const exportCsv = () => {
    if (!data) return;
    const lines = ["Metric,Value"];
    lines.push(`Total Patients,${data.total}`);
    lines.push(`Avg Risk Score,${data.avgRiskScore ?? "N/A"}`);
    lines.push(`Avg BMI,${data.avgBmi ?? "N/A"}`);
    lines.push(`Avg HbA1c,${data.avgHba1c ?? "N/A"}`);
    lines.push(`Avg Glucose,${data.avgGlucose ?? "N/A"}`);
    lines.push(`Comorbidity Rate,${data.comorbidityRate}%`);
    lines.push("");
    lines.push("Risk Distribution,Count");
    data.riskDistribution.forEach((d: any) => lines.push(`${d.category},${d.count}`));
    lines.push("");
    lines.push("Age Distribution,Count");
    data.ageDistribution.forEach((d: any) => lines.push(`${d.range},${d.count}`));
    lines.push("");
    lines.push("Gender Distribution,Count");
    data.genderDistribution.forEach((d: any) => lines.push(`${d.gender},${d.count}`));
    lines.push("");
    lines.push("Smoking Distribution,Count");
    data.smokingDistribution.forEach((d: any) => lines.push(`${d.status},${d.count}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cohort-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Cohort Discovery</h1>
          <p className="text-muted-foreground">Define filter criteria to identify patient subgroups and view population health insights.</p>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Filters</CardTitle>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">{activeFilterCount} active</span>
                )}
              </div>
              <div className="flex gap-2">
                {activeFilterCount > 0 && (
                  <button onClick={handleClear} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors">
                    <X className="w-3.5 h-3.5" /> Clear
                  </button>
                )}
                <button onClick={handleApply} className="rounded-lg bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                  Apply Filters
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="col-span-2 md:col-span-1">
                <p className="text-xs font-bold text-muted-foreground mb-2">Age Range</p>
                <div className="flex gap-2">
                  {renderFilterInput("Min", "minAge", "number", "0")}
                  {renderFilterInput("Max", "maxAge", "number", "120")}
                </div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <p className="text-xs font-bold text-muted-foreground mb-2">BMI Range</p>
                <div className="flex gap-2">
                  {renderFilterInput("Min", "minBmi", "number", "10")}
                  {renderFilterInput("Max", "maxBmi", "number", "80")}
                </div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <p className="text-xs font-bold text-muted-foreground mb-2">HbA1c Range</p>
                <div className="flex gap-2">
                  {renderFilterInput("Min", "minHba1c", "number", "3")}
                  {renderFilterInput("Max", "maxHba1c", "number", "20")}
                </div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <p className="text-xs font-bold text-muted-foreground mb-2">Glucose Range</p>
                <div className="flex gap-2">
                  {renderFilterInput("Min", "minGlucose", "number", "30")}
                  {renderFilterInput("Max", "maxGlucose", "number", "600")}
                </div>
              </div>
              {renderSelect("Gender", "gender", [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }, { value: "Other", label: "Other" }])}
              {renderSelect("Smoking", "smokingHistory", [{ value: "Never", label: "Never" }, { value: "Former", label: "Former" }, { value: "Current", label: "Current" }])}
              {renderSelect("Hypertension", "hypertension", [{ value: "true", label: "Yes" }, { value: "false", label: "No" }])}
              {renderSelect("Heart Disease", "heartDisease", [{ value: "true", label: "Yes" }, { value: "false", label: "No" }])}
              {renderSelect("Risk Category", "riskCategory", [{ value: "LOW", label: "Low" }, { value: "MODERATE", label: "Moderate" }, { value: "HIGH", label: "High" }])}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex h-[30vh] items-center justify-center">
            <div className="text-lg text-muted-foreground animate-pulse">Running cohort query...</div>
          </div>
        ) : error ? (
          <div className="flex h-[30vh] flex-col items-center justify-center gap-4">
            <AlertTriangle className="w-10 h-10 text-destructive" />
            <p className="text-lg text-destructive">Failed to load cohort data.</p>
            <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Please try again."}</p>
            <button onClick={handleApply} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Retry
            </button>
          </div>
        ) : !data || data.total === 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Results</h2>
            </div>
            <EmptyState
              icon={BarChart3}
              title={activeFilterCount === 0 ? "Apply filters to begin" : "No matching patients"}
              description={activeFilterCount === 0 ? "Use the filters above to define a cohort and click Apply." : "No assessments match the current filter criteria. Try broadening your filters."}
            />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Results</h2>
              <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Patients</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-500" />
                    <div className="text-3xl font-black text-foreground">{data.total}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Risk Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-500" />
                    <div className="text-3xl font-black text-foreground">{data.avgRiskScore != null ? Number(data.avgRiskScore).toFixed(1) : "N/A"}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg BMI</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-500" />
                    <div className="text-3xl font-black text-foreground">{data.avgBmi != null ? Number(data.avgBmi).toFixed(1) : "N/A"}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Comorbidity Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <div className="text-3xl font-black text-foreground">{data.comorbidityRate}%</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border shadow-sm bg-card md:col-span-2 lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-foreground">Risk Distribution</CardTitle>
                  <CardDescription className="text-muted-foreground">By risk category</CardDescription>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={riskDistData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {riskDistData.map((entry: any, i: number) => <Cell key={`rc-${i}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm bg-card md:col-span-2 lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-foreground">Age Distribution</CardTitle>
                  <CardDescription className="text-muted-foreground">Patient age buckets</CardDescription>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageDistData}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {ageDistData.map((_: any, i: number) => <Cell key={`ad-${i}`} fill={AGE_COLORS[i % AGE_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground">Gender Split</CardTitle>
                  <CardDescription className="text-muted-foreground">By gender</CardDescription>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={genderDistData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {genderDistData.map((_: any, i: number) => <Cell key={`gd-${i}`} fill={i === 0 ? "#818cf8" : "#f472b6"} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm bg-card md:col-span-2 lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-foreground">Smoking History</CardTitle>
                  <CardDescription className="text-muted-foreground">Distribution by smoking status</CardDescription>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={smokingDistData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {smokingDistData.map((_: any, i: number) => <Cell key={`sd-${i}`} fill={["#34d399", "#f59e0b", "#ef4444"][i % 3]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border shadow-sm bg-card md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-foreground">Average Metrics Summary</CardTitle>
                  <CardDescription className="text-muted-foreground">Cohort clinical averages</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Avg HbA1c", value: data.avgHba1c != null ? `${Number(data.avgHba1c).toFixed(1)}%` : "N/A" },
                      { label: "Avg Glucose", value: data.avgGlucose != null ? `${Number(data.avgGlucose).toFixed(0)} mg/dL` : "N/A" },
                      { label: "Avg BMI", value: data.avgBmi != null ? Number(data.avgBmi).toFixed(1) : "N/A" },
                      { label: "Avg Risk Score", value: data.avgRiskScore != null ? `${Number(data.avgRiskScore).toFixed(1)}%` : "N/A" },
                    ].map((m) => (
                      <div key={m.label} className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
                        <p className="text-xs font-semibold text-muted-foreground">{m.label}</p>
                        <p className="text-2xl font-black text-foreground mt-1">{m.value}</p>
                      </div>
                    ))}
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