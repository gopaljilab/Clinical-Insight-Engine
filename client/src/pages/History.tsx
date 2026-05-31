import { AppLayout } from "@/components/layout/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { useAssessments } from "@/hooks/use-assessments";
import { format, isValid } from "date-fns";
import { Loader2, Search, Calendar, User, Activity, X } from "lucide-react";
import { useState, useEffect } from "react";
import StatusPill from "@/components/ui/StatusPill";
import ConfidenceRange from "@/components/ui/ConfidenceRange";
import { FileText, RotateCw } from "lucide-react";
import { useLocation } from "wouter";
import { advancedFilter } from "@/utils/search_filters";

function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search.trim()) return <>{text}</>;
  
  const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-100 text-[#1E293B] rounded px-0.5 font-bold">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
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

  const getRiskBadge = (category: string) => {
    const key = (category || "").toUpperCase();
    const highlight = <HighlightText text={category} search={searchTerm} />;
    if (key === "LOW") return <StatusPill variant="low" label="LOW" highlightedLabel={<HighlightText text="LOW" search={searchTerm} />} />;
    if (key === "MODERATE") return <StatusPill variant="moderate" label="MODERATE" highlightedLabel={<HighlightText text="MODERATE" search={searchTerm} />} />;
    if (key === "HIGH") return <StatusPill variant="high" label="HIGH" highlightedLabel={<HighlightText text="HIGH" search={searchTerm} />} />;
    return <StatusPill variant="default" label={category || "Unknown"} highlightedLabel={highlight} />;
  };

  const [, setLocation] = useLocation();

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
    setTimeout(() => {
      w.print();
    }, 250);
  }

  const filteredAssessments = assessments ? advancedFilter(assessments, searchTerm) : [];

  const sortedAssessments = [...filteredAssessments].sort((a, b) => {
    switch (sortBy) {
      case "date-desc":
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case "date-asc":
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      case "risk-desc":
        return Number(b.riskScore) - Number(a.riskScore);
      case "risk-asc":
        return Number(a.riskScore) - Number(b.riskScore);
      case "age-desc":
        return b.age - a.age;
      case "age-asc":
        return a.age - b.age;
      case "bmi-desc":
        return Number(b.bmi) - Number(a.bmi);
      case "bmi-asc":
        return Number(a.bmi) - Number(b.bmi);
      default:
        return 0;
    }
  });

  const formatAssessmentDate = (dateVal: any) => {
    if (!dateVal) return "Unknown";
    const dateObj = new Date(dateVal);
    return isValid(dateObj) ? format(dateObj, 'MMM d, yyyy') : "Unknown";
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black font-display text-foreground tracking-tight">
              Patient History
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Review past preventive risk assessments.
            </p>
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
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full hover:bg-muted"
                  aria-label="Clear search query"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all w-full sm:w-48 text-sm font-semibold text-foreground cursor-pointer"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="risk-desc">Risk: High to Low</option>
              <option value="risk-asc">Risk: Low to High</option>
              <option value="age-desc">Age: Oldest First</option>
              <option value="age-asc">Age: Youngest First</option>
              <option value="bmi-desc">BMI: High to Low</option>
              <option value="bmi-asc">BMI: Low to High</option>
            </select>
          </div>
        </div>

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
              {searchTerm ? "No Matching Records" : "No Assessments Found"}
            </h3>
            <p className="text-muted-foreground max-w-md">
              {searchTerm 
                ? `No patient records matching "${searchTerm}" were found. Try refining your search terms.` 
                : "There are no patient assessments matching your criteria. Go to the dashboard to create a new assessment."}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
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
                  {sortedAssessments.map((assessment) => (
                    <tr key={assessment.id} className="hover:bg-muted/30 transition-colors text-sm">
                      <td className="p-4 whitespace-nowrap">
                        {formatAssessmentDate(assessment.createdAt)}
                      </td>
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
                            // confidenceInterval expected as string like "52.4% - 59.4%" or stored object
                            (() => {
                              const ci = assessment.confidenceInterval;
                              // try parsing "x% - y%"
                              if (typeof ci === 'string') {
                                const m = ci.match(/([0-9.]+)\s*%?\s*-\s*([0-9.]+)\s*%?/);
                                if (m) {
                                  const low = parseFloat(m[1]);
                                  const high = parseFloat(m[2]);
                                  return <ConfidenceRange low={low} high={high} value={Number(assessment.riskScore)} />;
                                }
                              }
                              // If confidenceInterval is an object with numeric low/high
                              if (ci && typeof ci === 'object' && 'low' in ci && 'high' in ci) {
                                const obj = ci as { low: number; high: number };
                                if (typeof obj.low === 'number' && typeof obj.high === 'number') {
                                  return <ConfidenceRange low={obj.low} high={obj.high} value={Number(assessment.riskScore)} />;
                                }
                              }
                              return <span className="text-[10px] text-muted-foreground font-normal">({String(ci)})</span>;
                            })()
                          ) : null}
                        </div>
                      </td>
                      <td className="p-4">
                        {getRiskBadge(assessment.riskCategory)}
                      </td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}