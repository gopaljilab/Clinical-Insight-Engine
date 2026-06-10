import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, isValid } from "date-fns";
import type { Assessment } from "@shared/schema";

interface PatientGroup {
  patientName: string;
  assessments: Assessment[];
  color: string;
}

interface Props {
  assessments: Assessment[];
  /** When provided, renders one line per patient for the selected metric */
  patientGroups?: PatientGroup[];
}

const PATIENT_COLORS = ["#2563EB", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

export const METRICS = [
  { key: "riskScore", label: "Risk Score (%)", color: "#2563EB", active: true },
  { key: "bmi", label: "BMI", color: "#06B6D4", active: false },
  { key: "hba1cLevel", label: "HbA1c (%)", color: "#10B981", active: false },
  { key: "bloodGlucoseLevel", label: "Blood Glucose", color: "#F59E0B", active: false },
];

function getRiskColor(score: number) {
  if (score >= 50) return "hsl(var(--destructive))";
  if (score >= 20) return "hsl(var(--chart-3))";
  return "hsl(var(--chart-2))";
}

export default function RiskTrendChart({ assessments, patientGroups }: Props) {
  const [activeMetrics, setActiveMetrics] = useState<Record<string, boolean>>(
    Object.fromEntries(METRICS.map(m => [m.key, m.active]))
  );

  const isComparisonMode = !!patientGroups && patientGroups.length > 0;

  const chartData = useMemo(() => {
    if (isComparisonMode) {
      const merged: Record<string, any> = {};
      for (const group of patientGroups!) {
        for (const a of group.assessments) {
          const dateObj = a.createdAt ? new Date(a.createdAt) : null;
          const dateKey = dateObj && isValid(dateObj) ? dateObj.toISOString() : `?${a.id}`;
          if (!merged[dateKey]) {
            merged[dateKey] = { date: dateKey };
          }
          merged[dateKey][`${group.patientName}_riskScore`] = Number(Number(a.riskScore).toFixed(1));
          merged[dateKey][`${group.patientName}_bmi`] = Number(Number(a.bmi).toFixed(1));
          merged[dateKey][`${group.patientName}_hba1cLevel`] = Number(Number(a.hba1cLevel).toFixed(1));
          merged[dateKey][`${group.patientName}_bloodGlucoseLevel`] = Number(Number(a.bloodGlucoseLevel).toFixed(1));
        }
      }
      return Object.values(merged).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    return [...assessments]
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
      .map(a => {
        const dateObj = a.createdAt ? new Date(a.createdAt) : null;
        return {
          date: dateObj && isValid(dateObj) ? dateObj.toISOString() : "?",
          riskScore: Number(Number(a.riskScore).toFixed(1)),
          bmi: Number(Number(a.bmi).toFixed(1)),
          hba1cLevel: Number(Number(a.hba1cLevel).toFixed(1)),
          bloodGlucoseLevel: Number(Number(a.bloodGlucoseLevel).toFixed(1)),
          riskCategory: a.riskCategory,
        };
      });
  }, [assessments, patientGroups, isComparisonMode]);

  function toggleMetric(key: string) {
    setActiveMetrics(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const canShowTrend = isComparisonMode
    ? patientGroups!.some(g => g.assessments.length >= 2)
    : chartData.length >= 2;

  if (!canShowTrend) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 text-center text-muted-foreground text-sm">
        {isComparisonMode
          ? "Selected patients need at least 2 assessments each to display trend analytics."
          : "At least 2 assessments are needed to display trend analytics."}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-black text-foreground">
            {isComparisonMode ? "Patient Comparison — Risk Trend" : "Risk Trend Analytics"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isComparisonMode
              ? "Comparing risk trajectories across selected patients"
              : "Historical metabolic vector trends over time"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {METRICS.map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              aria-pressed={activeMetrics[key]}
              onClick={() => toggleMetric(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                activeMetrics[key]
                  ? "text-white border-transparent"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
              }`}
              style={activeMetrics[key] ? { backgroundColor: color, borderColor: color } : {}}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={isComparisonMode ? 320 : 280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(iso: string) => {
              if (iso === "?") return "?";
              const d = new Date(iso);
              return isValid(d) ? format(d, "MMM d, HH:mm") : "?";
            }}
          />
          <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "12px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", color: "hsl(var(--foreground))" }} />
          {activeMetrics["riskScore"] && !isComparisonMode && (
            <>
              <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "High Risk", fontSize: 10, fill: "#EF4444" }} />
              <ReferenceLine y={20} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: "Moderate Risk", fontSize: 10, fill: "#F59E0B" }} />
            </>
          )}
          {isComparisonMode
            ? patientGroups!.map((group) => {
                const activeMetricKeys = METRICS.filter(m => activeMetrics[m.key]).map(m => m.key);
                return activeMetricKeys.map((metricKey) => {
                  const metricDef = METRICS.find(m => m.key === metricKey)!;
                  const dataKey = `${group.patientName}_${metricKey}`;
                  return (
                    <Line
                      key={dataKey}
                      type="monotone"
                      dataKey={dataKey}
                      name={`${group.patientName} — ${metricDef.label}`}
                      stroke={group.color}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: group.color, stroke: "white", strokeWidth: 1.5 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  );
                });
              })
            : METRICS.map(({ key, label, color }) =>
              activeMetrics[key] ? (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={label}
                  stroke={color}
                  strokeWidth={2.5}
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    const dotColor = key === "riskScore" ? getRiskColor(payload.riskScore) : color;
                    return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={dotColor} stroke="white" strokeWidth={1.5} />;
                  }}
                  activeDot={{ r: 6 }}
                />
              ) : null
            )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export { PATIENT_COLORS };
