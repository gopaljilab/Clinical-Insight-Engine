import { useState, useMemo, useEffect } from "react";
import { useAnalytics, type CriticalAlert } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, Users, AlertTriangle, BarChart3, Filter, Save, Trash2, Heart, Plus, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { formatReadableDate } from "@/utils/dateFormat";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const COLORS = {
  LOW: "#10b981", // Emerald 500
  MODERATE: "#f59e0b", // Amber 500
  HIGH: "#ef4444", // Red 500
};

interface SavedCohort {
  id: string;
  name: string;
  filters: Record<string, any>;
}

export default function Analytics() {
  const { toast } = useToast();
  
  // Cohort Filters State
  const [gender, setGender] = useState<string>("All");
  const [ageMin, setAgeMin] = useState<string>("");
  const [ageMax, setAgeMax] = useState<string>("");
  const [riskCategory, setRiskCategory] = useState<string>("All");
  const [bmiMin, setBmiMin] = useState<string>("");
  const [bmiMax, setBmiMax] = useState<string>("");
  const [hba1cMin, setHba1cMin] = useState<string>("");
  const [hba1cMax, setHba1cMax] = useState<string>("");
  const [glucoseMin, setGlucoseMin] = useState<string>("");
  const [glucoseMax, setGlucoseMax] = useState<string>("");
  const [hypertension, setHypertension] = useState<boolean | undefined>(undefined);
  const [heartDisease, setHeartDisease] = useState<boolean | undefined>(undefined);
  const [smokingHistory, setSmokingHistory] = useState<string>("All");

  // Saved Cohorts State
  const [savedCohorts, setSavedCohorts] = useState<SavedCohort[]>([]);
  const [newCohortName, setNewCohortName] = useState<string>("");

  // Load saved cohorts on mount
  useEffect(() => {
    const stored = localStorage.getItem("cie_saved_cohorts");
    if (stored) {
      try {
        setSavedCohorts(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved cohorts", e);
      }
    }
  }, []);

  // Compute active filters to pass to useAnalytics query hook
  const activeFilters = useMemo(() => {
    const filters: Record<string, any> = {};
    if (gender !== "All") filters.gender = gender;
    if (ageMin) filters.ageMin = parseInt(ageMin, 10);
    if (ageMax) filters.ageMax = parseInt(ageMax, 10);
    if (riskCategory !== "All") filters.riskCategory = riskCategory;
    if (bmiMin) filters.bmiMin = parseFloat(bmiMin);
    if (bmiMax) filters.bmiMax = parseFloat(bmiMax);
    if (hba1cMin) filters.hba1cMin = parseFloat(hba1cMin);
    if (hba1cMax) filters.hba1cMax = parseFloat(hba1cMax);
    if (glucoseMin) filters.glucoseMin = parseFloat(glucoseMin);
    if (glucoseMax) filters.glucoseMax = parseFloat(glucoseMax);
    if (hypertension !== undefined) filters.hypertension = hypertension;
    if (heartDisease !== undefined) filters.heartDisease = heartDisease;
    if (smokingHistory !== "All") filters.smokingHistory = smokingHistory;
    return filters;
  }, [
    gender, ageMin, ageMax, riskCategory, bmiMin, bmiMax,
    hba1cMin, hba1cMax, glucoseMin, glucoseMax, hypertension, heartDisease, smokingHistory
  ]);

  const { data: stats, isLoading, error } = useAnalytics(activeFilters);

  const distData = useMemo(
    () =>
      stats?.distribution.map((d) => ({
        name: d.category,
        value: d.count,
        color: COLORS[d.category as keyof typeof COLORS] ?? "#94a3b8",
      })) ?? [],
    [stats?.distribution]
  );

  // Format demographic data for stacked charts
  const genderChartData = useMemo(() => {
    if (!stats?.demographics.gender) return [];
    const map: Record<string, Record<string, number>> = {};
    stats.demographics.gender.forEach((r) => {
      if (!map[r.gender]) {
        map[r.gender] = { LOW: 0, MODERATE: 0, HIGH: 0 };
      }
      map[r.gender][r.riskCategory] = r.count;
    });
    return Object.entries(map).map(([gender, values]) => ({
      gender,
      ...values,
    }));
  }, [stats?.demographics.gender]);

  const ageChartData = useMemo(() => {
    if (!stats?.demographics.age) return [];
    const map: Record<string, Record<string, number>> = {};
    stats.demographics.age.forEach((r) => {
      if (!map[r.ageGroup]) {
        map[r.ageGroup] = { LOW: 0, MODERATE: 0, HIGH: 0 };
      }
      map[r.ageGroup][r.riskCategory] = r.count;
    });
    return Object.entries(map).map(([ageGroup, values]) => ({
      ageGroup,
      ...values,
    })).sort((a, b) => a.ageGroup.localeCompare(b.ageGroup));
  }, [stats?.demographics.age]);

  const handleSaveCohort = () => {
    if (!newCohortName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for the cohort.",
        variant: "destructive",
      });
      return;
    }
    const cohort: SavedCohort = {
      id: crypto.randomUUID(),
      name: newCohortName.trim(),
      filters: {
        gender, ageMin, ageMax, riskCategory, bmiMin, bmiMax,
        hba1cMin, hba1cMax, glucoseMin, glucoseMax, hypertension, heartDisease, smokingHistory
      }
    };
    const updated = [...savedCohorts, cohort];
    setSavedCohorts(updated);
    localStorage.setItem("cie_saved_cohorts", JSON.stringify(updated));
    setNewCohortName("");
    toast({
      title: "Cohort Saved",
      description: `"${cohort.name}" has been saved successfully.`,
    });
  };

  const handleLoadCohort = (cohort: SavedCohort) => {
    const f = cohort.filters;
    setGender(f.gender ?? "All");
    setAgeMin(f.ageMin ?? "");
    setAgeMax(f.ageMax ?? "");
    setRiskCategory(f.riskCategory ?? "All");
    setBmiMin(f.bmiMin ?? "");
    setBmiMax(f.bmiMax ?? "");
    setHba1cMin(f.hba1cMin ?? "");
    setHba1cMax(f.hba1cMax ?? "");
    setGlucoseMin(f.glucoseMin ?? "");
    setGlucoseMax(f.glucoseMax ?? "");
    setHypertension(f.hypertension);
    setHeartDisease(f.heartDisease);
    setSmokingHistory(f.smokingHistory ?? "All");
    toast({
      title: "Cohort Loaded",
      description: `Applied filters from "${cohort.name}".`,
    });
  };

  const handleDeleteCohort = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedCohorts.filter((c) => c.id !== id);
    setSavedCohorts(updated);
    localStorage.setItem("cie_saved_cohorts", JSON.stringify(updated));
    toast({
      title: "Cohort Deleted",
      description: "Saved cohort removed.",
    });
  };

  const handleResetFilters = () => {
    setGender("All");
    setAgeMin("");
    setAgeMax("");
    setRiskCategory("All");
    setBmiMin("");
    setBmiMax("");
    setHba1cMin("");
    setHba1cMax("");
    setGlucoseMin("");
    setGlucoseMax("");
    setHypertension(undefined);
    setHeartDisease(undefined);
    setSmokingHistory("All");
    toast({
      title: "Filters Reset",
      description: "Cohort builders filter set to default values.",
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-blue-500 animate-pulse" />
            Cohort Discovery & Insights
          </h1>
          <p className="text-muted-foreground">
            Dynamically segment patient populations, identify high-risk cohorts, and uncover aggregate health insights.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel: Cohort Builder */}
          <div className="w-full lg:w-80 shrink-0 space-y-6">
            <Card className="border-border shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-500" />
                  Cohort Builder
                </CardTitle>
                <CardDescription>Filter patients by clinical parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Gender */}
                <div className="space-y-1.5">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Genders</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Age Range */}
                <div className="space-y-1.5">
                  <Label>Age Range (Years)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={ageMin}
                      onChange={(e) => setAgeMin(e.target.value)}
                      className="w-full"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={ageMax}
                      onChange={(e) => setAgeMax(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Risk Category */}
                <div className="space-y-1.5">
                  <Label htmlFor="riskCategory">Risk Category</Label>
                  <Select value={riskCategory} onValueChange={setRiskCategory}>
                    <SelectTrigger id="riskCategory">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Risks</SelectItem>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MODERATE">Moderate</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* BMI Range */}
                <div className="space-y-1.5">
                  <Label>BMI Range</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Min"
                      value={bmiMin}
                      onChange={(e) => setBmiMin(e.target.value)}
                      className="w-full"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Max"
                      value={bmiMax}
                      onChange={(e) => setBmiMax(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* HbA1c Range */}
                <div className="space-y-1.5">
                  <Label>HbA1c Range (%)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Min"
                      value={hba1cMin}
                      onChange={(e) => setHba1cMin(e.target.value)}
                      className="w-full"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Max"
                      value={hba1cMax}
                      onChange={(e) => setHba1cMax(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Glucose Range */}
                <div className="space-y-1.5">
                  <Label>Blood Glucose Range (mg/dL)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={glucoseMin}
                      onChange={(e) => setGlucoseMin(e.target.value)}
                      className="w-full"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={glucoseMax}
                      onChange={(e) => setGlucoseMax(e.target.value)}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Comorbidities */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="hypertension" className="cursor-pointer">Hypertension</Label>
                    <Switch
                      id="hypertension"
                      checked={hypertension === true}
                      onCheckedChange={(checked) => setHypertension(checked ? true : undefined)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="heartDisease" className="cursor-pointer">Heart Disease</Label>
                    <Switch
                      id="heartDisease"
                      checked={heartDisease === true}
                      onCheckedChange={(checked) => setHeartDisease(checked ? true : undefined)}
                    />
                  </div>
                </div>

                <Button variant="outline" className="w-full mt-2" onClick={handleResetFilters}>
                  Clear Filters
                </Button>
              </CardContent>
            </Card>

            {/* Saved Cohorts */}
            <Card className="border-border shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Save className="h-4 w-4 text-emerald-500" />
                  Saved Cohorts
                </CardTitle>
                <CardDescription>Persist and reuse cohort definitions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Cohort name..."
                    value={newCohortName}
                    onChange={(e) => setNewCohortName(e.target.value)}
                  />
                  <Button size="icon" onClick={handleSaveCohort} title="Save current filters">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {savedCohorts.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {savedCohorts.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => handleLoadCohort(c)}
                        className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors text-sm"
                      >
                        <span className="font-medium truncate flex-1">{c.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                          onClick={(e) => handleDeleteCohort(c.id, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-2">
                    No saved cohorts yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Panel: Insights Dashboard */}
          <div className="flex-1 min-w-0 space-y-6">
            {isLoading ? (
              <div className="flex h-[60vh] items-center justify-center">
                <div className="text-lg text-muted-foreground animate-pulse flex items-center gap-2">
                  <Plus className="h-5 w-5 animate-spin text-blue-500" />
                  Analyzing cohort stats...
                </div>
              </div>
            ) : error || !stats ? (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
                <div className="text-lg text-destructive">Unable to load analytics data.</div>
                <p className="max-w-md text-center text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : "Please check your connection and try again."}
                </p>
              </div>
            ) : stats.totalPatients === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No Cohort Match"
                description="No patients match the defined filters. Try broadening your criteria in the Cohort Builder."
                actionLabel="Reset Filters"
                onClick={handleResetFilters}
              />
            ) : (
              <>
                {/* Cohort KPI Cards */}
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                  <Card className="border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cohort Size</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        <div className="text-2xl font-black text-foreground">{stats.totalPatients}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Average Risk</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-purple-500" />
                        <div className="text-2xl font-black text-foreground">{stats.averages.riskScore.toFixed(1)}%</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Average BMI</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-emerald-500" />
                        <div className="text-2xl font-black text-foreground">{stats.averages.bmi.toFixed(1)}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Average HbA1c</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-amber-500" />
                        <div className="text-2xl font-black text-foreground">{stats.averages.hba1c.toFixed(1)}%</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg Glucose</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-red-500" />
                        <div className="text-2xl font-black text-foreground">{stats.averages.glucose.toFixed(1)}</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Distribution Charts */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="border-border shadow-sm bg-card">
                    <CardHeader>
                      <CardTitle className="text-foreground">Risk Distribution</CardTitle>
                      <CardDescription className="text-muted-foreground">Breakdown of cohort population by cardiometabolic risk category.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={distData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {distData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }} />
                          <Legend wrapperStyle={{ color: "hsl(var(--foreground))" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Horizontal Bar Chart for Cohort Specific Risk Drivers */}
                  <Card className="border-border shadow-sm bg-card">
                    <CardHeader>
                      <CardTitle className="text-foreground">Primary Risk Drivers</CardTitle>
                      <CardDescription className="text-muted-foreground">Most prevalent risk contributing factors mapped inside this cohort.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      {stats.commonFactors && stats.commonFactors.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart layout="vertical" data={stats.commonFactors} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                            <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                            <YAxis dataKey="factor" type="category" width={110} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                              {stats.commonFactors.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${1 - index * 0.07})`} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No contributing factors registered in this cohort.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Demographics breakdown: Stacked Charts */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Age Distribution by Risk */}
                  <Card className="border-border shadow-sm bg-card">
                    <CardHeader>
                      <CardTitle className="text-foreground">Age Cohort Risk Profiles</CardTitle>
                      <CardDescription className="text-muted-foreground">Risk level distribution across age categories.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      {ageChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ageChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <XAxis dataKey="ageGroup" stroke="hsl(var(--muted-foreground))" />
                            <YAxis stroke="hsl(var(--muted-foreground))" />
                            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                            <Legend />
                            <Bar dataKey="LOW" name="Low Risk" stackId="a" fill={COLORS.LOW} />
                            <Bar dataKey="MODERATE" name="Moderate Risk" stackId="a" fill={COLORS.MODERATE} />
                            <Bar dataKey="HIGH" name="High Risk" stackId="a" fill={COLORS.HIGH} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No age demographics available.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Gender Distribution by Risk */}
                  <Card className="border-border shadow-sm bg-card">
                    <CardHeader>
                      <CardTitle className="text-foreground">Gender Cohort Risk Profiles</CardTitle>
                      <CardDescription className="text-muted-foreground">Risk level distribution across gender identities.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                      {genderChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={genderChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <XAxis dataKey="gender" stroke="hsl(var(--muted-foreground))" />
                            <YAxis stroke="hsl(var(--muted-foreground))" />
                            <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                            <Legend />
                            <Bar dataKey="LOW" name="Low Risk" stackId="a" fill={COLORS.LOW} />
                            <Bar dataKey="MODERATE" name="Moderate Risk" stackId="a" fill={COLORS.MODERATE} />
                            <Bar dataKey="HIGH" name="High Risk" stackId="a" fill={COLORS.HIGH} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          No gender demographics available.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Cohort Alerts Feed */}
                <Card className="border-border shadow-sm bg-card">
                  <CardHeader>
                    <CardTitle className="text-foreground">Critical Cohort Overviews</CardTitle>
                    <CardDescription className="text-muted-foreground">Highest risk cases in the selected sub-population group.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats.criticalAlerts.length > 0 ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        {stats.criticalAlerts.map((alert: CriticalAlert) => (
                          <div key={alert.id} className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/5 p-4 transition-all hover:bg-destructive/10">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                                <AlertTriangle className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-bold text-foreground">{alert.patientName}</p>
                                <p className="text-xs font-semibold text-muted-foreground">
                                  {alert.gender}, {alert.age} yrs • Assessed: {formatReadableDate(alert.createdAt, { fallback: "Unknown", includeTime: false })}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-black text-destructive">{Number(alert.riskScore).toFixed(1)}%</div>
                              <div className="text-[10px] font-bold uppercase tracking-wider text-destructive">Risk ({alert.riskCategory})</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-full min-h-[100px] items-center justify-center text-sm text-muted-foreground">
                        No critical alerts in this cohort.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
