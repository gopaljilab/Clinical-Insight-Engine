import React from 'react';
import { useMemo } from "react";
import { useAnalytics, type CriticalAlert } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, Users, AlertTriangle, BarChart3 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { formatReadableDate } from "@/utils/dateFormat";

const COLORS = {
  LOW: "#10b981", // Emerald 500
  MODERATE: "#f59e0b", // Amber 500
  HIGH: "#ef4444", // Red 500
};

export default function Analytics() {
  const { data: stats, isLoading, error } = useAnalytics();

  const distData = useMemo(
    () =>
      stats?.distribution.map((d) => ({
        name: d.category,
        value: d.count,
        color: COLORS[d.category as keyof typeof COLORS] ?? "#94a3b8",
      })) ?? [],
    [stats?.distribution]
  );

  const avgData = useMemo(
    () =>
      stats
        ? [
            { name: "Average BMI", value: stats.averages.bmi.toFixed(1) },
            { name: "Average HbA1c", value: stats.averages.hba1c.toFixed(1) },
          ]
        : [],
    [stats]
  );

  const factorsData = useMemo(() => {
    return stats?.commonFactors.map(f => ({
      name: f.factor,
      count: f.count
    })) ?? [];
  }, [stats?.commonFactors]);

  const ageData = useMemo(() => {
    if (!stats?.demographics?.age) return [];
    const groups = [...new Set(stats.demographics.age.map(a => a.ageGroup))];
    return groups.map(group => {
      const data = stats.demographics.age.filter(a => a.ageGroup === group);
      return {
        name: group,
        LOW: data.find(d => d.riskCategory === 'LOW')?.count || 0,
        MODERATE: data.find(d => d.riskCategory === 'MODERATE')?.count || 0,
        HIGH: data.find(d => d.riskCategory === 'HIGH')?.count || 0,
      };
    });
  }, [stats?.demographics?.age]);

  const genderData = useMemo(() => {
    if (!stats?.demographics?.gender) return [];
    const groups = [...new Set(stats.demographics.gender.map(g => g.gender))];
    return groups.map(group => {
      const data = stats.demographics.gender.filter(g => g.gender === group);
      return {
        name: group,
        LOW: data.find(d => d.riskCategory === 'LOW')?.count || 0,
        MODERATE: data.find(d => d.riskCategory === 'MODERATE')?.count || 0,
        HIGH: data.find(d => d.riskCategory === 'HIGH')?.count || 0,
      };
    });
  }, [stats?.demographics?.gender]);

  return (
    <AppLayout>
      {isLoading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-lg text-muted-foreground animate-pulse">Loading analytics...</div>
        </div>
      ) : error || !stats ? (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
          <div className="text-lg text-destructive">Unable to load analytics data.</div>
          <p className="max-w-md text-center text-sm text-muted-foreground">
            {error instanceof Error ? (error as Error).message : "Please check your connection and try again."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      ) : stats.totalPatients === 0 ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-foreground">Provider Analytics</h1>
            <p className="text-muted-foreground">Population health management and risk distribution across your patients.</p>
          </div>
          <EmptyState
            icon={BarChart3}
            title="No Analytics Data"
            description="There is no patient data available to generate analytics. Create assessments to see population health trends."
            actionLabel="Create Assessment"
            actionHref="/dashboard"
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-black tracking-tight text-foreground">Provider Analytics</h1>
            <p className="text-muted-foreground">Population health management and risk distribution across your patients.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-border bg-card shadow-sm backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Patients Assessed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  <div className="text-3xl font-black text-foreground">{stats.totalPatients}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Average BMI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  <div className="text-3xl font-black text-foreground">{stats.averages.bmi.toFixed(1)}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm backdrop-blur">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Average HbA1c</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-amber-500" />
                  <div className="text-3xl font-black text-foreground">{stats.averages.hba1c.toFixed(1)}%</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border shadow-sm bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Risk Distribution</CardTitle>
                <CardDescription className="text-muted-foreground">Breakdown of patient population by cardiometabolic risk category.</CardDescription>
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

            <Card className="border-border shadow-sm bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Critical Alerts Feed</CardTitle>
                <CardDescription className="text-muted-foreground">Highest risk assessments requiring immediate provider oversight.</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.criticalAlerts.length > 0 ? (
                  <div className="space-y-4">
                    {stats.criticalAlerts.map((alert: CriticalAlert) => (
                      <div key={alert.id} className="flex items-center justify-between rounded-xl border border-destructive/20 bg-destructive/10 p-4">
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
                          <div className="text-xs font-bold uppercase tracking-wider text-destructive">Risk</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-muted-foreground">
                    No critical alerts found.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border shadow-sm bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Demographics (Risk by Age)</CardTitle>
                <CardDescription className="text-muted-foreground">Breakdown of cardiometabolic risk across age groups.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }} />
                    <Legend wrapperStyle={{ color: "hsl(var(--foreground))" }} />
                    <Bar dataKey="LOW" stackId="a" fill={COLORS.LOW} />
                    <Bar dataKey="MODERATE" stackId="a" fill={COLORS.MODERATE} />
                    <Bar dataKey="HIGH" stackId="a" fill={COLORS.HIGH} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Demographics (Risk by Gender)</CardTitle>
                <CardDescription className="text-muted-foreground">Breakdown of cardiometabolic risk by gender.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={genderData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }} />
                    <Legend wrapperStyle={{ color: "hsl(var(--foreground))" }} />
                    <Bar dataKey="LOW" stackId="a" fill={COLORS.LOW} />
                    <Bar dataKey="MODERATE" stackId="a" fill={COLORS.MODERATE} />
                    <Bar dataKey="HIGH" stackId="a" fill={COLORS.HIGH} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card className="border-border shadow-sm bg-card">
              <CardHeader>
                <CardTitle className="text-foreground">Most Common Risk Factors</CardTitle>
                <CardDescription className="text-muted-foreground">Most frequent contributing factors across the patient cohort.</CardDescription>
              </CardHeader>
              <CardContent className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={factorsData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} width={150} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Occurrences" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

