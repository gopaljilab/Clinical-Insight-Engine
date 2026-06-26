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

function clampRisk(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function getRiskCategory(score: number) {
  if (score >= 50) return "HIGH";
  if (score >= 20) return "MODERATE";
  return "LOW";
}

export default function RiskTrendChart({ assessments }: Props) {
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

  const chartData = useMemo(() => {
    const sorted = [...assessments].sort(
      (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );

    return sorted
      .map(a => {
        const dateObj = a.createdAt ? new Date(a.createdAt) : null;
        return {
          date: dateObj && isValid(dateObj) ? dateObj.toISOString() : "?",
          timestamp: dateObj && isValid(dateObj) ? dateObj.getTime() : null,
          riskScore: Number(Number(a.riskScore).toFixed(1)),
          bmi: Number(Number(a.bmi).toFixed(1)),
          hba1cLevel: Number(Number(a.hba1cLevel).toFixed(1)),
          bloodGlucoseLevel: Number(Number(a.bloodGlucoseLevel).toFixed(1)),
          riskCategory: a.riskCategory,
        };
      })
      .filter((point) => point.timestamp !== null);
  }, [assessments]);
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

  const forecastData = useMemo(() => {
    if (chartData.length < 2) return [];

    const points = chartData
      .filter((point) => typeof point.timestamp === "number")
      .map((point) => ({ x: point.timestamp as number, y: point.riskScore }));

    const n = points.length;
    const base = points[0].x;
    const sumX = points.reduce((acc, p) => acc + (p.x - base) / 86400000, 0);
    const sumY = points.reduce((acc, p) => acc + p.y, 0);
    const sumXY = points.reduce((acc, p) => acc + ((p.x - base) / 86400000) * p.y, 0);
    const sumXX = points.reduce((acc, p) => acc + Math.pow((p.x - base) / 86400000, 2), 0);
    const slope = n * sumXY - sumX * sumY;
    const denom = n * sumXX - sumX * sumX;
    const rate = denom === 0 ? 0 : slope / denom;
    const intercept = (sumY - rate * sumX) / n;

    const lastPoint = points[points.length - 1];
    const futureOffsets = [90, 180, 365];

    return futureOffsets.map((offsetDays) => {
      const futureX = lastPoint.x + offsetDays * 86400000;
      const value = clampRisk(intercept + rate * ((futureX - base) / 86400000));
      return {
        date: new Date(futureX).toISOString(),
        timestamp: futureX,
        forecastedRiskScore: value,
        forecastMonths: offsetDays === 90 ? "3 Month" : offsetDays === 180 ? "6 Month" : "12 Month",
        riskCategory: getRiskCategory(value),
      };
    });
  }, [chartData]);

  const combinedData = useMemo(() => {
    if (forecastData.length === 0) return chartData;
    return [
      ...chartData,
      ...forecastData.map((point) => ({
        ...point,
        riskScore: null,
        bmi: null,
        hba1cLevel: null,
        bloodGlucoseLevel: null,
      })),
    ];
  }, [chartData, forecastData]);

  const forecastSummary = useMemo(() => {
    if (forecastData.length === 0) return null;

    const lastActual = chartData[chartData.length - 1]?.riskScore ?? 0;
    const lastTwo = chartData.slice(-2).map((point) => point.riskScore);
    const delta = lastTwo.length === 2 ? Number((lastTwo[1] - lastTwo[0]).toFixed(1)) : 0;
    const meanDelta = chartData.length > 2
      ? chartData.slice(1).reduce((acc, point, index) => acc + (point.riskScore - chartData[index].riskScore), 0) / (chartData.length - 1)
      : delta;
    const acceleration = delta > meanDelta * 1.5 && delta > 0 ? "Accelerating risk" : delta < meanDelta * 0.5 && delta < 0 ? "Risk improving" : "Stable trajectory";

    return {
      outlook: acceleration,
      lastActual: clampRisk(lastActual),
      forecastItems: forecastData,
    };
  }, [chartData, forecastData]);

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

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={combinedData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(iso: string) => {
                  if (iso === "?") return "?";
                  const d = new Date(iso);
                  return isValid(d) ? format(d, "MMM d") : "?";
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
                formatter={(value: any, name: string) => [value, name === "forecastedRiskScore" ? "Forecast" : name]}
              />
              <Legend wrapperStyle={{ fontSize: "12px", color: "hsl(var(--foreground))" }} />
              {activeMetrics["riskScore"] && (
                <>
                  <ReferenceLine y={50} stroke="#EF4444" strokeDasharray="4 4" label={{ value: "High Risk", fontSize: 10, fill: "#EF4444" }} />
                  <ReferenceLine y={20} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: "Moderate Risk", fontSize: 10, fill: "#F59E0B" }} />
                </>
              )}
              {METRICS.map(({ key, label, color }) =>
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
              {!!forecastData.length && (
                <Line
                  type="monotone"
                  dataKey="forecastedRiskScore"
                  name="Risk Forecast"
                  stroke="#8B5CF6"
                  strokeDasharray="6 4"
                  dot={{ stroke: "#8B5CF6", strokeWidth: 2, fill: "white", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {forecastSummary && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-black text-foreground">Forecast Summary</h3>
            <p className="text-sm text-muted-foreground mt-1">Projected risk changes based on this patient’s prior trajectory.</p>

            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-border bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500 font-semibold">Current risk</p>
                <p className="text-3xl font-black text-foreground">{forecastSummary.lastActual}%</p>
                <p className="text-sm text-muted-foreground mt-1">{forecastSummary.outlook}</p>
              </div>

              {forecastSummary.forecastItems.map((item) => (
                <div key={item.forecastMonths} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.forecastMonths}</p>
                      <p className="text-xs text-muted-foreground">Predicted category: {item.riskCategory}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-foreground">{item.forecastedRiskScore}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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
