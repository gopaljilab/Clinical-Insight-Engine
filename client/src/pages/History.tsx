import { AppLayout } from "@/components/layout/AppLayout";
import RiskTrendChart from "@/components/RiskTrendChart";
import { useToast } from "@/hooks/use-toast";
import { useAssessments } from "@/hooks/use-assessments";
import { format, isValid } from "date-fns";
import { Loader2, Search, X, Activity, FileText, RotateCw, GitCompare, Download } from "lucide-react";
import { Loader2, Search, Calendar, User, Activity, X, SlidersHorizontal } from "lucide-react";
import { useState, useEffect } from "react";
import StatusPill from "@/components/ui/StatusPill";
import ConfidenceRange from "@/components/ui/ConfidenceRange";
import { useLocation } from "wouter";
import { advancedFilter } from "@/utils/search_filters";
import { safeParseDate } from "@/utils/date_fix";
import { useToast } from "@/hooks/use-toast";
import {
  advancedFilter,
  hasActiveMetricFilters,
  type MetricKey,
  type MetricRangeFilters,
} from "@/utils/search_filters";

const metricFilterConfig: Array<{
  key: MetricKey;
  label: string;
  unit: string;
  minPlaceholder: string;
  maxPlaceholder: string;
}> = [
  { key: "bmi", label: "BMI", unit: "kg/m2", minPlaceholder: "30", maxPlaceholder: "60" },
  { key: "hba1cLevel", label: "HbA1c", unit: "%", minPlaceholder: "7.5", maxPlaceholder: "15" },
  { key: "bloodGlucoseLevel", label: "Blood Glucose", unit: "mg/dL", minPlaceholder: "150", maxPlaceholder: "400" },
];

type MetricInputState = Record<MetricKey, { min: string; max: string }>;

const emptyMetricInputs: MetricInputState = {
  bmi: { min: "", max: "" },
  hba1cLevel: { min: "", max: "" },
  bloodGlucoseLevel: { min: "", max: "" },
};

function parseBound(value: string) {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
}

function toMetricFilters(inputs: MetricInputState): MetricRangeFilters {
  return Object.fromEntries(
    Object.entries(inputs).map(([key, range]) => [
      key,
      {
        min: parseBound(range.min),
        max: parseBound(range.max),
      },
    ]),
  ) as MetricRangeFilters;
}

function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search.trim()) return <>{text}</>;
  const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-100 text-[#1E293B] rounded px-0.5 font-bold">{part}</mark>
        ) : part
      )}
    </>
  );
}

const METRICS = [
  { key: "age", label: "Age", unit: "" },
  { key: "bmi", label: "BMI", unit: "" },
  { key: "hba1cLevel", label: "HbA1c", unit: "%" },
  { key: "bloodGlucoseLevel", label: "Blood Glucose", unit: "" },
  { key: "riskScore", label: "Risk Score", unit: "%" },
];

const BOOL_METRICS = [
  { key: "hypertension", label: "Hypertension" },
  { key: "heartDisease", label: "Heart Disease" },
];

function getDelta(a: number, b: number) {
  const diff = b - a;
  return diff;
}

function ComparisonModal({ a, b, onClose }: { a: any; b: any; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-black text-foreground">Assessment Comparison</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors" aria-label="Close comparison">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Header row */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Metric</div>
            <div className="text-center">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assessment A</span>
              <div className="text-xs text-muted-foreground mt-0.5">{format(new Date(a.createdAt), 'MMM d, yyyy')}</div>
            </div>
            <div className="text-center">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Assessment B</span>
              <div className="text-xs text-muted-foreground mt-0.5">{format(new Date(b.createdAt), 'MMM d, yyyy')}</div>
            </div>
          </div>

          {/* Numeric metrics */}
          <div className="space-y-2">
            {METRICS.map(({ key, label, unit }) => {
              const valA = Number(a[key]);
              const valB = Number(b[key]);
              const delta = getDelta(valA, valB);
              const isRisk = key === "riskScore";
              const isGood = isRisk ? delta < 0 : false;
              const isBad = isRisk ? delta > 0 : false;
              return (
                <div key={key} className="grid grid-cols-3 gap-4 items-center py-3 border-b border-border/50 last:border-0">
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                  <div className="text-center text-sm font-bold text-foreground">{valA.toFixed(1)}{unit}</div>
                  <div className="text-center">
                    <span className="text-sm font-bold text-foreground">{valB.toFixed(1)}{unit}</span>
                    {delta !== 0 && (
                      <span className={`ml-2 text-xs font-bold ${isGood ? 'text-green-600' : isBad ? 'text-red-500' : delta < 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}{unit}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Boolean metrics */}
            {BOOL_METRICS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-3 gap-4 items-center py-3 border-b border-border/50 last:border-0">
                <div className="text-sm font-semibold text-foreground">{label}</div>
                <div className="text-center text-sm font-bold text-foreground">{a[key] ? 'Yes' : 'No'}</div>
                <div className="text-center">
                  <span className="text-sm font-bold text-foreground">{b[key] ? 'Yes' : 'No'}</span>
                  {a[key] !== b[key] && (
                    <span className={`ml-2 text-xs font-bold ${b[key] ? 'text-red-500' : 'text-green-600'}`}>
                      {b[key] ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Risk category */}
            <div className="grid grid-cols-3 gap-4 items-center py-3">
              <div className="text-sm font-semibold text-foreground">Risk Category</div>
              <div className="text-center">
                <span className={`text-xs font-black px-2 py-1 rounded-full ${a.riskCategory === 'HIGH' ? 'bg-red-100 text-red-700' : a.riskCategory === 'MODERATE' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  {a.riskCategory}
                </span>
              </div>
              <div className="text-center">
                <span className={`text-xs font-black px-2 py-1 rounded-full ${b.riskCategory === 'HIGH' ? 'bg-red-100 text-red-700' : b.riskCategory === 'MODERATE' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                  {b.riskCategory}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function History() {
  useEffect(() => {
    document.title = "Clinical Insight Engine - Assessment History";
  }, []);

  const { data: assessments, isLoading, error } = useAssessments();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [metricInputs, setMetricInputs] = useState<MetricInputState>(emptyMetricInputs);

  const getRiskBadge = (category: string) => {
    const key = (category || "").toUpperCase();
    if (key === "LOW") return <StatusPill variant="low" label="LOW" highlightedLabel={<HighlightText text="LOW" search={searchTerm} />} />;
    if (key === "MODERATE") return <StatusPill variant="moderate" label="MODERATE" highlightedLabel={<HighlightText text="MODERATE" search={searchTerm} />} />;
    if (key === "HIGH") return <StatusPill variant="high" label="HIGH" highlightedLabel={<HighlightText text="HIGH" search={searchTerm} />} />;
    return <StatusPill variant="default" label={category || "Unknown"} highlightedLabel={<HighlightText text={category} search={searchTerm} />} />;
  };

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) {
          toast({ title: "Selection limit", description: "You can only compare 2 assessments at a time. Deselect one first.", variant: "destructive" });
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function reloadToForm(assessment: any) {
    const draft = {
      gender: assessment.gender,
      age: assessment.age,
      hypertension: assessment.hypertension,
      heartDisease: assessment.heartDisease,
      smokingHistory: assessment.smokingHistory,
      bmi: assessment.bmi,
      hba1cLevel: assessment.hba1cLevel,
      bloodGlucoseLevel: assessment.bloodGlucoseLevel,
    };
    try {
      localStorage.setItem("clinical-insight-assessment-draft", JSON.stringify(draft));
      setLocation("/dashboard");
    } catch (e) {
      console.error("Failed to set draft:", e);
    }
  }

  function exportAsPdf(assessment: any) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Assessment ${assessment.id}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial; padding:24px; color:#0f172a} h1{font-size:20px} .kv{margin:6px 0} .pill{display:inline-block;padding:6px 10px;border-radius:999px;background:#f3f4f6;color:#111827;font-weight:700} table{width:100%;border-collapse:collapse;margin-top:12px} td{padding:6px;border-bottom:1px solid #e6e6e6}</style></head><body><h1>Assessment Summary</h1><p class="kv"><strong>Date:</strong> ${new Date(assessment.createdAt).toLocaleString()}</p><p class="kv"><strong>Risk Score:</strong> ${Number(assessment.riskScore).toFixed(1)}%</p><p class="kv"><strong>Category:</strong> <span class="pill">${assessment.riskCategory}</span></p><h2 style="margin-top:18px;font-size:16px">Vitals & Inputs</h2><table><tbody><tr><td>Age</td><td>${assessment.age}</td></tr><tr><td>BMI</td><td>${assessment.bmi}</td></tr><tr><td>HbA1c</td><td>${assessment.hba1cLevel}%</td></tr><tr><td>Blood Glucose</td><td>${assessment.bloodGlucoseLevel}</td></tr><tr><td>Hypertension</td><td>${assessment.hypertension ? 'Yes' : 'No'}</td></tr><tr><td>Heart Disease</td><td>${assessment.heartDisease ? 'Yes' : 'No'}</td></tr><tr><td>Smoking</td><td>${assessment.smokingHistory}</td></tr></tbody></table><h2 style="margin-top:18px;font-size:16px">Top Factors</h2><ul>${(assessment.factors || []).slice(0,5).map((f:any)=>`<li>${f.name} — ${f.description} (${f.impact})</li>`).join('')}</ul></body></html>`;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      toast({
        title: "Popups blocked",
        description: "Please allow popups for this site to enable PDF export.",
        variant: "destructive",
      });
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 250);
  }

  const metricFilters = toMetricFilters(metricInputs);
  const hasMetricFilters = hasActiveMetricFilters(metricFilters);
  const hasActiveFilters = searchTerm.trim().length > 0 || hasMetricFilters;
  const [exportFormat, setExportFormat] = useState<"csv" | "xlsx">("csv");
  const [isExporting, setIsExporting] = useState(false);

  function exportLedger(data: any[], fmt: "csv" | "xlsx") {
    setIsExporting(true);
    try {
      const headers = ["Date", "Age", "Gender", "BMI", "HbA1c", "Blood Glucose", "Hypertension", "Heart Disease", "Smoking", "Risk Score", "Category", "Confidence Interval"];
      const rows = data.map(a => [
        a.createdAt ? format(new Date(a.createdAt), "yyyy-MM-dd") : "",
        a.age, a.gender, a.bmi, a.hba1cLevel, a.bloodGlucoseLevel,
        a.hypertension ? "Yes" : "No",
        a.heartDisease ? "Yes" : "No",
        a.smokingHistory,
        Number(a.riskScore).toFixed(1),
        a.riskCategory,
        a.confidenceInterval || "",
      ]);

      if (fmt === "csv") {
        const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `clinical-insight-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Simple XLSX using XML SpreadsheetML
        const xmlRows = [headers, ...rows].map(row =>
          `<Row>${row.map(v => `<Cell><Data ss:Type="String">${String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</Data></Cell>`).join("")}</Row>`
        ).join("");
        const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Assessments"><Table>${xmlRows}</Table></Worksheet></Workbook>`;
        const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `clinical-insight-export-${format(new Date(), "yyyy-MM-dd")}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast({ title: "Export complete", description: `${data.length} records exported as .${fmt}` });
    } catch (e) {
      toast({ title: "Export failed", description: "Unable to generate the export file.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  }

  const filteredAssessments = assessments ? advancedFilter(assessments, searchTerm, metricFilters) : [];

  function updateMetricInput(key: MetricKey, bound: "min" | "max", value: string) {
    setMetricInputs((current) => ({
      ...current,
      [key]: {
        ...current[key],
        [bound]: value,
      },
    }));
  }

  function clearAllFilters() {
    setSearchTerm("");
    setMetricInputs(emptyMetricInputs);
  }

  const sortedAssessments = [...filteredAssessments].sort((a, b) => {
    switch (sortBy) {
      case "date-desc": return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case "date-asc": return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      case "risk-desc": return Number(b.riskScore) - Number(a.riskScore);
      case "risk-asc": return Number(a.riskScore) - Number(b.riskScore);
      case "age-desc": return b.age - a.age;
      case "age-asc": return a.age - b.age;
      case "bmi-desc": return Number(b.bmi) - Number(a.bmi);
      case "bmi-asc": return Number(a.bmi) - Number(b.bmi);
      default: return 0;
    }
  });

  const formatAssessmentDate = (dateVal: any) => {
    if (!dateVal) return "Unknown";
    const dateObj = safeParseDate(String(dateVal));
    return dateObj && isValid(dateObj) ? format(dateObj, 'MMM d, yyyy') : "Unknown";
  };

  const selectedArray = assessments ? assessments.filter(a => selectedIds.has(a.id)) : [];

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black font-display text-foreground tracking-tight">Patient History</h1>
            <p className="text-muted-foreground mt-2 text-lg">Review past preventive risk assessments.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search history..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all w-full sm:w-64"
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full hover:bg-muted" aria-label="Clear search query">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all w-full sm:w-48 text-sm font-semibold text-foreground cursor-pointer">
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="risk-desc">Risk: High to Low</option>
              <option value="risk-asc">Risk: Low to High</option>
              <option value="age-desc">Age: Oldest First</option>
              <option value="age-asc">Age: Youngest First</option>
              <option value="bmi-desc">BMI: High to Low</option>
              <option value="bmi-asc">BMI: Low to High</option>
            </select>
            <div className="flex items-center gap-2">
              <select
                value={exportFormat}
                onChange={e => setExportFormat(e.target.value as "csv" | "xlsx")}
                className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-semibold text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                aria-label="Export format"
              >
                <option value="csv">.CSV</option>
                <option value="xlsx">.XLS</option>
              </select>
              <button
                type="button"
                onClick={() => exportLedger(sortedAssessments, exportFormat)}
                disabled={isExporting || sortedAssessments.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm font-semibold text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export Ledger
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowAdvancedFilters((current) => !current)}
              aria-expanded={showAdvancedFilters}
              aria-controls="advanced-triage-filters"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm font-semibold text-foreground"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Advanced Filters
            </button>
          </div>
        </div>

        {showAdvancedFilters && (
          <section
            id="advanced-triage-filters"
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            aria-label="Advanced triage filters"
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">Advanced Triage Filters</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Combine numeric boundaries to isolate high-risk patient cohorts instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={clearAllFilters}
                disabled={!hasActiveFilters}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold border border-border bg-white hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                Clear All Filters
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {metricFilterConfig.map((metric) => (
                <div key={metric.key} className="rounded-xl border border-border bg-background/60 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <label className="font-semibold text-foreground">{metric.label}</label>
                    <span className="text-xs text-muted-foreground">{metric.unit}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Minimum
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={metricInputs[metric.key].min}
                        placeholder={metric.minPlaceholder}
                        onChange={(event) => updateMetricInput(metric.key, "min", event.target.value)}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Maximum
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={metricInputs[metric.key].max}
                        placeholder={metric.maxPlaceholder}
                        onChange={(event) => updateMetricInput(metric.key, "max", event.target.value)}
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mt-4" aria-label="Active triage filters">
                {searchTerm.trim() && (
                  <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 text-xs font-semibold">
                    Text: {searchTerm.trim()}
                  </span>
                )}
                {metricFilterConfig.map((metric) => {
                  const range = metricInputs[metric.key];
                  if (!range.min && !range.max) return null;
                  return (
                    <span
                      key={metric.key}
                      className="rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-3 py-1 text-xs font-semibold"
                    >
                      {metric.label}: {range.min || "any"} to {range.max || "any"}
                    </span>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {!isLoading && !error && assessments && assessments.length >= 2 && (
          <RiskTrendChart assessments={filteredAssessments.length > 0 ? filteredAssessments : assessments} />
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p>Loading assessment history...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-center">
            Failed to load history. Please try again later.
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 text-muted-foreground">
              <Activity className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              {hasActiveFilters ? "No Matching Records" : "No Assessments Found"}
            </h3>
            <p className="text-muted-foreground max-w-md">
              {hasActiveFilters
                ? "No patient records match the current text search and triage boundaries. Try relaxing one or more filters."
                : "There are no patient assessments matching your criteria. Go to the dashboard to create a new assessment."}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="p-4 font-semibold">
                      <span className="sr-only">Select for comparison</span>
                    </th>
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Age</th>
                    <th className="p-4 font-semibold">BMI</th>
                    <th className="p-4 font-semibold">HbA1c</th>
                    <th className="p-4 font-semibold">Glucose</th>
                    <th className="p-4 font-semibold">HTN</th>
                    <th className="p-4 font-semibold">HD</th>
                    <th className="p-4 font-semibold">Smoking</th>
                    <th className="p-4 font-semibold">Risk Score</th>
                    <th className="p-4 font-semibold">Category</th>
                    <th className="p-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedAssessments.map((assessment) => {
                    const isSelected = selectedIds.has(assessment.id);
                    return (
                      <tr key={assessment.id} className={`hover:bg-muted/30 transition-colors text-sm ${isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''}`}>
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(assessment.id)}
                            aria-label={`Select assessment from ${formatAssessmentDate(assessment.createdAt)} for comparison`}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                          />
                        </td>
                        <td className="p-4 whitespace-nowrap">{formatAssessmentDate(assessment.createdAt)}</td>
                        <td className="p-4"><HighlightText text={String(assessment.age)} search={searchTerm} /></td>
                        <td className="p-4 font-medium"><HighlightText text={String(assessment.bmi)} search={searchTerm} /></td>
                        <td className="p-4 font-medium"><HighlightText text={String(assessment.hba1cLevel)} search={searchTerm} />%</td>
                        <td className="p-4 font-medium"><HighlightText text={String(assessment.bloodGlucoseLevel)} search={searchTerm} /></td>
                        <td className="p-4">{assessment.hypertension ? 'Yes' : 'No'}</td>
                        <td className="p-4">{assessment.heartDisease ? 'Yes' : 'No'}</td>
                        <td className="p-4"><HighlightText text={assessment.smokingHistory} search={searchTerm} /></td>
                        <td className="p-4">
                          <div className="font-bold flex items-center gap-3">
                            <span>{Number(assessment.riskScore).toFixed(1)}%</span>
                            {assessment.confidenceInterval ? (
                              (() => {
                                const ci = assessment.confidenceInterval;
                                if (typeof ci === 'string') {
                                  const m = ci.match(/([0-9.]+)\s*%?\s*-\s*([0-9.]+)\s*%?/);
                                  if (m) return <ConfidenceRange low={parseFloat(m[1])} high={parseFloat(m[2])} value={Number(assessment.riskScore)} />;
                                }
                                if (ci && typeof ci === 'object' && 'low' in ci && 'high' in ci) {
                                  const obj = ci as { low: number; high: number };
                                  if (typeof obj.low === 'number' && typeof obj.high === 'number') return <ConfidenceRange low={obj.low} high={obj.high} value={Number(assessment.riskScore)} />;
                                }
                                return <span className="text-[10px] text-muted-foreground font-normal">({String(ci)})</span>;
                              })()
                            ) : null}
                          </div>
                        </td>
                        <td className="p-4">{getRiskBadge(assessment.riskCategory)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <button onClick={() => reloadToForm(assessment)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-100 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100">
                              <RotateCw className="w-4 h-4" />
                              Reload
                            </button>
                            <button onClick={() => exportAsPdf(assessment)} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-white border border-slate-100 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100">
                              <FileText className="w-4 h-4" />
                              Export
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Floating comparison panel */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-4 bg-card border border-border rounded-2xl shadow-2xl px-6 py-4">
            <span className="text-sm font-semibold text-foreground">
              {selectedIds.size === 1 ? "1 record selected — select one more to compare" : "2 records selected"}
            </span>
            {selectedIds.size === 2 && (
              <button
                onClick={() => setCompareModalOpen(true)}
                className="inline-flex items-center gap-2 bg-primary text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
              >
                <GitCompare className="w-4 h-4" />
                Compare Records
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Comparison modal */}
      {compareModalOpen && selectedArray.length === 2 && (
        <ComparisonModal
          a={selectedArray[0]}
          b={selectedArray[1]}
          onClose={() => setCompareModalOpen(false)}
        />
      )}
    </AppLayout>
  );
}
