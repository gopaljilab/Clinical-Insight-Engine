import { AppLayout } from "@/components/layout/AppLayout";
import { useAssessments } from "@/hooks/use-assessments";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from "recharts";

export default function ProgressTracking() {
  const { data: assessments, isLoading, error } = useAssessments();

  const chartData =
    assessments?.map((assessment) => ({
      date: assessment.createdAt
        ? format(new Date(assessment.createdAt), "MMM d")
        : "Unknown",
      bmi: Number(assessment.bmi),
      hba1c: Number(assessment.hba1cLevel),
      glucose: Number(assessment.bloodGlucoseLevel),
      riskScore: Number(assessment.riskScore),
    })) ?? [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
          <p>Loading progress data...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-center">
          Failed to load progress data.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black font-display">
            Progress Tracking
          </h1>
          <p className="text-muted-foreground mt-2">
            Track biomarker and risk score trends over time.
          </p>
        </div>

        <div>
          <select className="px-4 py-2 rounded-xl border border-border bg-card">
            <option>Last 30 Days</option>
            <option>Last 6 Months</option>
            <option>Last Year</option>
            <option>All Time</option>
          </select>
        </div>

        {/* HbA1c */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="text-lg font-bold mb-4">HbA1c Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <ReferenceLine y={5.7} label="Normal" />
              <ReferenceLine y={6.5} label="Elevated" />
              <Line
                type="monotone"
                dataKey="hba1c"
                stroke="#2563eb"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Blood Glucose */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="text-lg font-bold mb-4">Blood Glucose Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <ReferenceLine y={140} label="Warning" />
              <Line
                type="monotone"
                dataKey="glucose"
                stroke="#dc2626"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* BMI */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="text-lg font-bold mb-4">BMI Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="bmi"
                stroke="#16a34a"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Score */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="text-lg font-bold mb-4">Risk Score Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <ReferenceLine y={10} label="Low" />
              <ReferenceLine y={20} label="Moderate" />
              <Line
                type="monotone"
                dataKey="riskScore"
                stroke="#f59e0b"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </AppLayout>
  );
}