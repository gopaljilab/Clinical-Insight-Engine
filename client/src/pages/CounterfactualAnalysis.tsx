import { useState, useCallback, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  Search, ArrowDown, ArrowUp,
  Loader2, AlertCircle, Lightbulb, BarChart3, Target,
} from "lucide-react";
import { formatReadableDate } from "@/utils/dateFormat";
import { useWhatIfBatch } from "@/hooks/use-assessments";

function getBarColor(reduction: number) {
  if (reduction > 5) return "#10b981";
  if (reduction > 2) return "#34d399";
  if (reduction > 0) return "#a7f3d0";
  return "#fca5a5";
}

export default function CounterfactualAnalysis() {
  const [searchQuery, setSearchQuery] = useState("");
  const [patientName, setPatientName] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [latestAssessment, setLatestAssessment] = useState<any | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const whatIfBatch = useWhatIfBatch();

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    try {
      const res = await fetch(`/api/assessments/autocomplete?q=${encodeURIComponent(q)}`, { credentials: "include" });
      if (res.ok) {
        const names = await res.json();
        setSuggestions(names);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, fetchSuggestions]);

  const loadPatient = useCallback(async (name: string) => {
    setPatientName(name);
    setSearchQuery(name);
    setSuggestions([]);
    setLoadingPatient(true);
    setError(null);
    setLatestAssessment(null);
    try {
      const res = await fetch(`/api/assessments/patient/${encodeURIComponent(name)}/trends`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load patient data");
      const data = await res.json();
      const assessments = data.data ?? [];
      if (assessments.length === 0) {
        setError("No assessments found for this patient.");
        return;
      }
      const sorted = [...assessments].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latest = sorted[0];
      setLatestAssessment(latest);
    } catch (err: any) {
      setError(err.message || "Failed to load patient data");
    } finally {
      setLoadingPatient(false);
    }
  }, []);

  useEffect(() => {
    if (!latestAssessment) return;
    const a = latestAssessment;
    const original = {
      patientName: a.patientName,
      gender: a.gender as "Male" | "Female",
      age: a.age,
      hypertension: a.hypertension,
      heartDisease: a.heartDisease,
      smokingHistory: a.smokingHistory as "current" | "never" | "No Info" | "former",
      bmi: a.bmi ?? 25,
      hba1cLevel: a.hba1cLevel ?? 5.5,
      bloodGlucoseLevel: a.bloodGlucoseLevel ?? 100,
    };
    const perturbations: Record<string, string | number | boolean>[] = [
      { bmi: 25 },
      { bmi: 22 },
      { hba1cLevel: 5.7 },
      { hba1cLevel: 6.0 },
      { bloodGlucoseLevel: 100 },
      { bloodGlucoseLevel: 90 },
    ];
    if (a.smokingHistory === "current") {
      perturbations.push({ smokingHistory: "never" });
      perturbations.push({ smokingHistory: "former" });
    }
    if (a.hypertension) {
      perturbations.push({ hypertension: false });
    }
    if (a.heartDisease) {
      perturbations.push({ heartDisease: false });
    }
    whatIfBatch.mutate({ original, perturbations });
  }, [latestAssessment]);

  const chartData = useMemo(() => {
    if (!whatIfBatch.data?.ranked) return [];
    return whatIfBatch.data.ranked
      .filter((r: any) => r.riskReduction > 0)
      .sort((a: any, b: any) => b.riskReduction - a.riskReduction)
      .slice(0, 10)
      .map((r: any) => ({
        name: r.delta.length > 35 ? r.delta.substring(0, 35) + "..." : r.delta,
        fullLabel: r.delta,
        reduction: r.riskReduction,
        newScore: r.riskScore,
        newCategory: r.riskCategory,
      }));
  }, [whatIfBatch.data]);

  const topSuggestion = chartData[0];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Counterfactual "What-If" Analysis</h1>
          <p className="text-muted-foreground">See which single health change would most reduce a patient's diabetes risk, ranked by potential improvement.</p>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Select Patient</CardTitle>
            <CardDescription>Search for a patient to analyze their latest assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search patient name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.trim()) loadPatient(searchQuery.trim()); }}
                className="h-10 w-full max-w-md rounded-xl border border-border bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full max-w-md rounded-xl border border-border bg-card shadow-lg">
                  {suggestions.map((name) => (
                    <button
                      key={name}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted first:rounded-t-xl last:rounded-b-xl"
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
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loadingPatient && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!loadingPatient && patientName && !latestAssessment && !error && (
          <Card className="border-border">
            <CardContent className="py-12 text-center text-muted-foreground">
              No assessment records found for <strong>{patientName}</strong>.
            </CardContent>
          </Card>
        )}

        {latestAssessment && (
          <>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{patientName}</p>
                <p className="text-xs text-muted-foreground">
                  Latest assessment: {formatReadableDate(latestAssessment.createdAt, { includeTime: false })} &middot;
                  Risk: <strong>{latestAssessment.riskScore?.toFixed(1)}%</strong> ({latestAssessment.riskCategory})
                </p>
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                <span>BMI {latestAssessment.bmi}</span>
                <span>HbA1c {latestAssessment.hba1cLevel}%</span>
                <span>Glucose {latestAssessment.bloodGlucoseLevel}</span>
              </div>
            </div>

            {whatIfBatch.isPending && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Running counterfactual simulations...</p>
                </div>
              </div>
            )}

            {whatIfBatch.isError && (
              <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {(whatIfBatch.error as any)?.message || "Failed to run counterfactual analysis."}
              </div>
            )}

            {topSuggestion && !whatIfBatch.isPending && (
              <Card className="border-green-200 dark:border-green-900 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/50">
                      <Lightbulb className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-800 dark:text-green-300 uppercase tracking-wider">Biggest Impact</p>
                      <p className="text-xl font-black text-green-900 dark:text-green-100 mt-1">
                        {topSuggestion.fullLabel}
                      </p>
                      <p className="text-green-700 dark:text-green-400 mt-2">
                        Could reduce risk by <strong className="text-2xl">{topSuggestion.reduction.toFixed(1)}%</strong> &mdash; from {latestAssessment.riskScore?.toFixed(1)}% to {topSuggestion.newScore.toFixed(1)}% ({topSuggestion.newCategory})
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {chartData.length > 0 && !whatIfBatch.isPending && (
              <Card className="border-border shadow-sm bg-card">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-foreground">Ranked Risk Reductions</CardTitle>
                  </div>
                  <CardDescription className="text-muted-foreground">
                    Sorted by greatest potential improvement. Each bar shows the risk reduction from changing one factor.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} label={{ value: "Risk Reduction (%)", position: "bottom", style: { fontSize: 12, fill: "hsl(var(--muted-foreground))" } }} />
                        <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <Tooltip
                          formatter={(value: number) => [`${value.toFixed(1)}%`, "Risk Reduction"]}
                          labelFormatter={(label) => {
                            const item = chartData.find((d) => d.name === label);
                            return item?.fullLabel ?? label;
                          }}
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }}
                        />
                        <Bar dataKey="reduction" radius={[0, 6, 6, 0]} barSize={28}>
                          {chartData.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={getBarColor(entry.reduction)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {whatIfBatch.data?.ranked && whatIfBatch.data.ranked.length > 0 && !whatIfBatch.isPending && (
              <Card className="border-border shadow-sm bg-card">
                <CardHeader>
                  <CardTitle className="text-foreground">All Simulated Changes</CardTitle>
                  <CardDescription className="text-muted-foreground">Ranked by potential risk reduction</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[...whatIfBatch.data.ranked]
                      .sort((a: any, b: any) => b.riskReduction - a.riskReduction)
                      .map((item: any, i: number) => {
                        const isReduction = item.riskReduction > 0;
                        return (
                          <div key={item.delta} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3.5">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {i + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{item.delta}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  New risk: {item.riskScore.toFixed(1)}% ({item.riskCategory})
                                </p>
                              </div>
                            </div>
                            <div className={`flex shrink-0 items-center gap-1 font-bold ml-3 ${isReduction ? "text-green-600" : "text-red-500"}`}>
                              {isReduction ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                              {Math.abs(item.riskReduction).toFixed(1)}%
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            {whatIfBatch.data?.ranked?.length === 0 && !whatIfBatch.isPending && !whatIfBatch.isError && (
              <Card className="border-border">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold">No improvements found</p>
                  <p className="text-sm mt-1">The current assessment profile already has low risk factors. No significant risk reduction opportunities were identified.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {!patientName && !loadingPatient && !error && (
          <Card className="border-border bg-muted/30">
            <CardContent className="py-16 text-center">
              <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
              <h3 className="text-lg font-bold text-foreground mb-2">How it works</h3>
              <div className="max-w-lg mx-auto space-y-3 text-sm text-muted-foreground">
                <p>1. <strong>Search</strong> for a patient by name</p>
                <p>2. The system analyzes their <strong>latest assessment</strong></p>
                <p>3. It simulates changing each risk factor one at a time (e.g., reducing BMI, lowering HbA1c)</p>
                <p>4. Results are <strong>ranked</strong> to show which single change would produce the greatest risk reduction</p>
                <p>5. A <strong>bar chart</strong> visualizes the potential improvements</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}