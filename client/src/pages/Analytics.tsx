import { useAnalytics } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Activity, Users, AlertTriangle } from "lucide-react";

const COLORS = {
  LOW: "#10b981", // Emerald 500
  MODERATE: "#f59e0b", // Amber 500
  HIGH: "#ef4444", // Red 500
};

export default function Analytics() {
  const { data: stats, isLoading, error } = useAnalytics();

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-lg text-slate-500 animate-pulse">Loading analytics...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-lg text-red-500">Failed to load analytics data.</div>
      </div>
    );
  }

  const distData = stats.distribution.map(d => ({
    name: d.category,
    value: d.count,
    color: COLORS[d.category] || "#94a3b8"
  }));

  const avgData = [
    { name: "Average BMI", value: stats.averages.bmi.toFixed(1) },
    { name: "Average HbA1c", value: stats.averages.hba1c.toFixed(1) }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Provider Analytics</h1>
        <p className="text-slate-500">Population health management and risk distribution across your patients.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="border-slate-200 bg-white/50 shadow-sm backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Patients Assessed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div className="text-3xl font-black text-slate-900">{stats.totalPatients}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/50 shadow-sm backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Average BMI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              <div className="text-3xl font-black text-slate-900">{stats.averages.bmi.toFixed(1)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white/50 shadow-sm backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Average HbA1c</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-amber-500" />
              <div className="text-3xl font-black text-slate-900">{stats.averages.hba1c.toFixed(1)}%</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Risk Distribution</CardTitle>
            <CardDescription>Breakdown of patient population by cardiometabolic risk category.</CardDescription>
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
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Critical Alerts Feed</CardTitle>
            <CardDescription>Highest risk assessments requiring immediate provider oversight.</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.criticalAlerts.length > 0 ? (
              <div className="space-y-4">
                {stats.criticalAlerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50/50 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{alert.patientName}</p>
                        <p className="text-xs font-semibold text-slate-500">
                          {alert.gender}, {alert.age} yrs • Assessed: {new Date(alert.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-red-600">{Number(alert.riskScore).toFixed(1)}%</div>
                      <div className="text-xs font-bold uppercase tracking-wider text-red-500">Risk</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-slate-500">
                No critical alerts found.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
