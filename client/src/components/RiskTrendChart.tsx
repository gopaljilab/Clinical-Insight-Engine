import { useState, useEffect } from "react";
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
import type { Assessment } from "@shared/schema";
import { formatCompactDate } from "@/utils/dateFormat";
// Vite's specific syntax to import as a web worker
import ChartWorker from "@/utils/chartWorker?worker";
import { cn } from "@/lib/utils";
interface PatientGroup {
  patientName: string;
  assessments: Assessment[];
  color: string;
}

interface Props {
  assessments: Assessment[];
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
  
  // States for worker data and loading sequence
  const [chartData, setChartData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(true);

  const isComparisonMode = !!patientGroups && patientGroups.length > 0;

  // Web Worker abstraction logic
  useEffect(() => {
    setIsProcessing(true);
    const worker = new ChartWorker();

    worker.postMessage({
      assessments,
      patientGroups,
      isComparisonMode
    });

    worker.onmessage = (e) => {
      setChartData(e.data);
      setIsProcessing(false);
    };

    return () => {
      worker.terminate(); // Cleanup to prevent memory leaks
    };
  }, [assessments, patientGroups, isComparisonMode]);

  function toggleMetric(key: string) {
    setActiveMetrics(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // Pre-calculate if trend can be shown using props, avoiding reliance on async chartData
  const canShowTrend = isComparisonMode
    ? patientGroups!.some(g => g.assessments.length >= 2)
    : assessments.length >= 2;

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
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                activeMetrics[key]
                  ? "text-white bg-[var(--chart-color)] border-[var(--chart-color)]"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
              )}
              style={{ '--chart-color': color } as React.CSSProperties}
            >
              <span className="w-2 h-2 rounded-full bg-[var(--chart-color)]" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={isComparisonMode ? 320 : 280}>
        {isProcessing ? (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
             Processing high-frequency metrics...
          </div>
        ) : (
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={(iso: string) => {
                if (iso === "?") return "?";
                return formatCompactDate(iso);
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
        )}
      </ResponsiveContainer>
    </div>
  );
}

export { PATIENT_COLORS };
