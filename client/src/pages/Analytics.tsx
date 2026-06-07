import { useAnalytics, type CriticalAlert } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, Users, AlertTriangle, BarChart3 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EmptyState } from "@/components/EmptyState";

const COLORS = {
  LOW: "#10b981", // Emerald 500
  MODERATE: "#f59e0b", // Amber 500
  HIGH: "#ef4444", // Red 500
};

export default function Analytics() {
  const { data: stats, isLoading, error } = useAnalytics();

  const distData = stats?.distribution.map(d => ({
    name: d.category,
    value: d.count,
    color: COLORS[d.category as keyof typeof COLORS] || "#94a3b8"
  })) || [];

  const avgData = stats ? [
    { name: "Average BMI", value: stats.averages.bmi.toFixed(1) },
    { name: "Average HbA1c", value: stats.averages.hba1c.toFixed(1) }
  ] : [];

  return (
    <AppLayout>
      {isLoading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-lg text-muted-foreground animate-pulse">Loading analytics...</div>
        </div>
      ) : error || !stats ? (
        <div className="flex h-[50vh] items-center justify-center">
          <div className="text-lg text-destructive">Failed to load analytics data.</div>
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
                              {alert.gender}, {alert.age} yrs • Assessed: {alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : "Unknown"}
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
        </div>
      )}
    </AppLayout>
  );
}
