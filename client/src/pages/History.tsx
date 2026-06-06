import { AppLayout } from "@/components/layout/AppLayout";
import { useAssessments, usePatientAssessments, useClearPatientCache } from "@/hooks/use-assessments";
import {
  format,
  isValid,
} from "date-fns";
import {
  Loader2,
  User,
  Activity,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import StatusPill from "@/components/ui/StatusPill";
import ConfidenceRange from "@/components/ui/ConfidenceRange";
import { FileText, RotateCw } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { filterAssessments, type GenderFilterValue, type RiskCategoryFilterValue } from "@/utils/filterAssessments";
import { advancedFilter } from "@/utils/search_filters";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import RiskTrendChart from "@/components/RiskTrendChart";
import HealthBadges from "@/components/HealthBadges";
import { calculateHealthBadges } from "@/utils/healthBadges";
import { AssessmentSearchBar } from "@/components/AssessmentSearchBar";
import { AssessmentFilters } from "@/components/AssessmentFilters";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { ClearFiltersButton } from "@/components/ClearFiltersButton";
import { validateSearchInput } from "@/validation/filterValidation";

function HighlightText({ text, search }: { text: string; search: string }) {
  if (!search.trim()) return <>{text}</>;

  const escaped = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="bg-yellow-100 text-[#1E293B] rounded px-0.5 font-bold"
          >
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

  const { toast } = useToast();


  const { data: infiniteData, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useAssessments();
  const assessments = infiniteData ? infiniteData.pages.flatMap((page) => page.data) : [];
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("date-desc");

  // New filter state
  const [riskCategory, setRiskCategory] = useState<RiskCategoryFilterValue>("All");
  const [gender, setGender] = useState<GenderFilterValue>("All");
  const [minAge, setMinAge] = useState<number | undefined>(undefined);
  const [maxAge, setMaxAge] = useState<number | undefined>(undefined);

  // Date filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Refs to programmatically trigger the pop-up calendar on click
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  const [selectedPatientKey, setSelectedPatientKey] = useState<string | null>(null);
  const clearPatientCache = useClearPatientCache();

  /**
   * Build a stable per-patient key from the two fields that are recorded at
   * assessment time and never change for a real patient: name + gender.
   * Filtering by name alone would merge unrelated patients who share the same
   * name (issue #794).
   */
  const patientKey = (a: { patientName?: string | null; gender?: string | null }) =>
    `${(a.patientName || "Unknown Patient").toLowerCase().trim()}|${(a.gender || "").toLowerCase().trim()}`;

  // Derive the plain name for the cache-scoped patient query from the composite key.
  const selectedPatientName = selectedPatientKey ? selectedPatientKey.split("|")[0] : null;

  // FIX for Issue #744: use a patient-scoped query so switching patients
  // never leaks the previous patient's cached clinical data into the new view.
  const {
    data: patientInfiniteData,
    isLoading: patientLoading,
  } = usePatientAssessments(selectedPatientName);

  // When a new patient is selected, clear the previous patient's cache entry
  // and reset search state so no stale data is shown during the transition.
  const handleSelectPatient = (key: string | null) => {
    const prevName = selectedPatientKey ? selectedPatientKey.split("|")[0] : null;
    const nextName = key ? key.split("|")[0] : null;
    if (prevName && prevName !== nextName) {
      clearPatientCache(prevName);
    }
    setSelectedPatientKey(key);
    // Reset search/filter state to avoid cross-patient filter bleed-through.
    setSearchTerm("");
    setRiskCategory("All");
    setGender("All");
    setMinAge(undefined);
    setMaxAge(undefined);
    setStartDate("");
    setEndDate("");
  };

  const selectedPatientHistory = useMemo(() => {
    if (!selectedPatientKey) return [];
    // Use the patient-scoped query data (isolated cache) filtered by composite
    // key to prevent same-name cross-patient data leakage (issues #744, #794).
    const source = patientInfiniteData
      ? patientInfiniteData.pages.flatMap((page) => page.data)
      : assessments;
    return source.filter(a => patientKey(a) === selectedPatientKey);
  }, [assessments, selectedPatientKey, patientInfiniteData]);

  // Suppress unused warning — patientLoading is intentionally tracked for future use
  void patientLoading;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (searchTerm) {
      params.set("filter", searchTerm);
    } else {
      params.delete("filter");
    }
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [searchTerm]);

  const handleUploadLabResults = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload/lab-results", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to upload");
      toast({ title: "Success", description: data.message });
    } catch (err: any) {
      toast({ title: "Upload Error", description: err.message, variant: "destructive" });
    }
    e.target.value = ''; // Reset input
  };

  const getRiskBadge = (category: string) => {
    const key = (category || "").toUpperCase();
    const highlight = <HighlightText text={category} search={searchTerm} />;
    if (key === "LOW")
      return (
        <StatusPill
          variant="low"
          label="LOW"
          highlightedLabel={<HighlightText text="LOW" search={searchTerm} />}
        />
      );
    if (key === "MODERATE")
      return (
        <StatusPill
          variant="moderate"
          label="MODERATE"
          highlightedLabel={
            <HighlightText text="MODERATE" search={searchTerm} />
          }
        />
      );
    if (key === "HIGH")
      return (
        <StatusPill
          variant="high"
          label="HIGH"
          highlightedLabel={<HighlightText text="HIGH" search={searchTerm} />}
        />
      );
    return (
      <StatusPill
        variant="default"
        label={category || "Unknown"}
        highlightedLabel={highlight}
      />
    );
  };

  const [, setLocation] = useLocation();

  function reloadToForm(assessment: any) {
    const draft = {
      patientName: assessment.patientName ?? "",
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
      localStorage.setItem(
        "clinical-insight-assessment-draft",
        JSON.stringify(draft)
      );
      setLocation("/dashboard");
    } catch (e) {
      console.error("Failed to set draft:", e);
    }
  }

  function escapeHtml(value: unknown): string {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function exportAsPdf(assessment: any) {
    if (!assessment) return;

    const patientName = escapeHtml(assessment.patientName || "Unknown Patient");
    const date = escapeHtml(assessment.createdAt ? new Date(assessment.createdAt).toLocaleString() : "Unknown Date");
    const age = escapeHtml(assessment.age ?? "N/A");
    const bmi = escapeHtml(assessment.bmi ?? "N/A");
    const hba1cLevel = escapeHtml(assessment.hba1cLevel ?? "N/A");
    const bloodGlucoseLevel = escapeHtml(assessment.bloodGlucoseLevel ?? "N/A");
    const hypertension = escapeHtml(assessment.hypertension === true ? "Yes" : assessment.hypertension === false ? "No" : "N/A");
    const heartDisease = escapeHtml(assessment.heartDisease === true ? "Yes" : assessment.heartDisease === false ? "No" : "N/A");
    const smokingHistory = escapeHtml(assessment.smokingHistory || "N/A");

    const riskScore = escapeHtml(
      assessment.riskScore ? `${Number(assessment.riskScore).toFixed(1)}%` : "N/A"
    );

    const category = escapeHtml(assessment.riskCategory || "Unknown");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Assessment ${escapeHtml(assessment.id ?? "Export")}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial; padding:24px; color:#0f172a} h1{font-size:20px} .kv{margin:6px 0} .pill{display:inline-block;padding:6px 10px;border-radius:999px;background:#f3f4f6;color:#111827;font-weight:700} table{width:100%;border-collapse:collapse;margin-top:12px} td{padding:6px;border-bottom:1px solid #e6e6e6}</style></head><body><h1>Assessment Summary</h1><p class="kv"><strong>Patient:</strong> ${patientName}</p><p class="kv"><strong>Date:</strong> ${date}</p><p class="kv"><strong>Risk Score:</strong> ${riskScore}</p><p class="kv"><strong>Category:</strong> <span class="pill">${category}</span></p><h2 style="margin-top:18px;font-size:16px">Vitals &amp; Inputs</h2><table><tbody><tr><td>Age</td><td>${age}</td></tr><tr><td>BMI</td><td>${bmi}</td></tr><tr><td>HbA1c</td><td>${hba1cLevel}${assessment.hba1cLevel != null ? "%" : ""}</td></tr><tr><td>Blood Glucose</td><td>${bloodGlucoseLevel}</td></tr><tr><td>Hypertension</td><td>${hypertension}</td></tr><tr><td>Heart Disease</td><td>${heartDisease}</td></tr><tr><td>Smoking</td><td>${smokingHistory}</td></tr></tbody></table><h2 style="margin-top:18px;font-size:16px">Top Factors</h2><ul>${(
      assessment.factors || []
    )
      .slice(0, 5)
      .map((f: any) => `<li>${escapeHtml(f.name || "Unknown")} — ${escapeHtml(f.description || "")} (${escapeHtml(f.impact || "N/A")})</li>`)
      .join("")}</ul></body></html>`;

    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      alert("Please allow popups to enable PDF export.");
      return;
    }

    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
    }, 250);
  }

  const filteredAssessments = useMemo(() => {
    return filterAssessments(assessments, {
      searchTerm,
      riskCategory,
      gender,
      ageRange: {
        min: minAge,
        max: maxAge,
      },
      dateRange: {
        startDate,
        endDate,
      },
    });
  }, [assessments, searchTerm, riskCategory, gender, minAge, maxAge, startDate, endDate]);

  // 3. Sorting Records
  const sortedAssessments = [...filteredAssessments].sort((a, b) => {
    switch (sortBy) {
      case "date-desc":
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      case "date-asc":
        return (
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
        );
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

  const latestBadgeAssessment = useMemo(() => {
    if (sortedAssessments.length === 0) return null;
    return (
      sortedAssessments.find((assessment) =>
        calculateHealthBadges(assessment, sortedAssessments).length > 0
      ) || sortedAssessments[0]
    );
  }, [sortedAssessments]);

  const latestBadges = useMemo(() => {
    if (!latestBadgeAssessment) return [];
    return calculateHealthBadges(latestBadgeAssessment, sortedAssessments);
  }, [latestBadgeAssessment, sortedAssessments]);

  const selectedPatientBadges = useMemo(() => {
    const sortedHistory = [...selectedPatientHistory].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );

    if (sortedHistory.length === 0) return [];
    return calculateHealthBadges(sortedHistory[0], sortedHistory);
  }, [selectedPatientHistory]);

  // 4. Pagination
  const totalRecords = assessments.length;
  const filteredRecords = sortedAssessments.length;
  const paginatedAssessments = sortedAssessments;

  const formatAssessmentDate = (dateVal: any) => {
    if (!dateVal) return "Unknown";
    const dateObj = new Date(dateVal);
    return isValid(dateObj) ? format(dateObj, "MMM d, yyyy") : "Unknown";
  };

  const clearDateFilters = () => {
    setStartDate("");
    setEndDate("");
  };

  const triggerStartPicker = () => {
    if (startInputRef.current && "showPicker" in startInputRef.current) {
      startInputRef.current.showPicker();
    }
  };

  const triggerEndPicker = () => {
    if (endInputRef.current && "showPicker" in endInputRef.current) {
      endInputRef.current.showPicker();
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black font-display text-foreground tracking-tight flex items-center gap-3">
              Patient History
              <span className="text-sm font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200">
                Showing {filteredRecords} of {totalRecords}
              </span>
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Review past preventive risk assessments.
            </p>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <AssessmentSearchBar
                value={searchTerm}
                onSearch={setSearchTerm}
                onClear={() => setSearchTerm("")}
              />
              <AssessmentFilters
                riskCategory={riskCategory}
                gender={gender}
                minAge={minAge}
                maxAge={maxAge}
                startDate={startDate}
                endDate={endDate}
                onRiskChange={setRiskCategory}
                onGenderChange={setGender}
                onAgeChange={({ minAge: nextMinAge, maxAge: nextMaxAge }) => {
                  setMinAge(nextMinAge);
                  setMaxAge(nextMaxAge);
                }}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                onClearDateRange={clearDateFilters}
              />
            </div>
            <div className="space-y-4 rounded-3xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Filters active</p>
                  <p className="text-sm text-muted-foreground">Use these chips to remove filters quickly.</p>
                </div>
                <ClearFiltersButton onClear={clearAllFilters} disabled={!hasActiveFilters} />
              </div>
              <ActiveFilterChips chips={activeFilterChips} onClearAll={clearAllFilters} />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
            {/* Upload Lab Results Button */}
            <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors shadow-sm">
              <Upload className="w-4 h-4" />
              Upload Lab Results
              <input type="file" className="sr-only" onChange={handleUploadLabResults} />
            </label>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-border bg-card focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 transition-all w-full sm:w-48 text-sm font-semibold text-foreground cursor-pointer"
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
        ) : totalRecords === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 text-muted-foreground">
              <Activity className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No Assessments Found</h3>
            <p className="text-muted-foreground max-w-md">
              There are no patient assessments loaded yet. Go to the dashboard to create a new assessment.
            </p>
          </div>
        ) : filteredRecords === 0 ? (
          <div className="bg-card border border-border border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 text-muted-foreground">
              <Activity className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No Matching Records</h3>
            <p className="text-muted-foreground max-w-md">
              No patient records matching your current filter limits were found. Try refining or clearing your filters.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-6">
              <HealthBadges
                badges={latestBadges}
                title="Latest improvement badges"
                description="Badges earned when a patient assessment improves key metrics or lowers overall risk compared to prior records."
              />
              <AssessmentComparisonCard
                assessments={sortedAssessments}
              />
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/50 border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="p-4 font-semibold">Date</th>
                    <th className="p-4 font-semibold">Patient</th>
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
                  {paginatedAssessments.map((assessment) => (
                    <tr
                      key={assessment.id}
                      className="hover:bg-muted/30 transition-colors text-sm"
                    >
                      <td className="p-4 whitespace-nowrap">
                        {formatAssessmentDate(assessment.createdAt)}
                      </td>
                      <td className="p-4 font-medium whitespace-nowrap">
                        <HighlightText
                          text={assessment.patientName || "Unknown Patient"}
                          search={searchTerm}
                        />
                      </td>
                      <td className="p-4">
                        <HighlightText
                          text={String(assessment.age)}
                          search={searchTerm}
                        />
                      </td>
                      <td className="p-4 font-medium">
                        <HighlightText
                          text={String(assessment.bmi)}
                          search={searchTerm}
                        />
                      </td>
                      <td className="p-4 font-medium">
                        <HighlightText
                          text={String(assessment.hba1cLevel)}
                          search={searchTerm}
                        />
                        %
                      </td>
                      <td className="p-4 font-medium">
                        <HighlightText
                          text={String(assessment.bloodGlucoseLevel)}
                          search={searchTerm}
                        />
                      </td>
                      <td className="p-4">
                        {assessment.hypertension ? "Yes" : "No"}
                      </td>
                      <td className="p-4">
                        {assessment.heartDisease ? "Yes" : "No"}
                      </td>
                      <td className="p-4">
                        <HighlightText
                          text={assessment.smokingHistory}
                          search={searchTerm}
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-bold flex items-center gap-3">
                          <span>
                            {Number(assessment.riskScore).toFixed(1)}%
                          </span>
                          {assessment.confidenceInterval
                            ? (() => {
                                const ci = assessment.confidenceInterval;
                                if (typeof ci === "string") {
                                  const m = ci.match(
                                    /([0-9.]+)\s*%?\s*-\s*([0-9.]+)\s*%?/
                                  );
                                  if (m) {
                                    const low = parseFloat(m[1]);
                                    const high = parseFloat(m[2]);
                                    return (
                                      <ConfidenceRange
                                        low={low}
                                        high={high}
                                        value={Number(assessment.riskScore)}
                                      />
                                    );
                                  }
                                }
                                if (
                                  ci &&
                                  typeof ci === "object" &&
                                  "low" in ci &&
                                  "high" in ci
                                ) {
                                  const obj = ci as {
                                    low: number;
                                    high: number;
                                  };
                                  if (
                                    typeof obj.low === "number" &&
                                    typeof obj.high === "number"
                                  ) {
                                    return (
                                      <ConfidenceRange
                                        low={obj.low}
                                        high={obj.high}
                                        value={Number(assessment.riskScore)}
                                      />
                                    );
                                  }
                                }
                                return (
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    ({String(ci)})
                                  </span>
                                );
                              })()
                            : null}
                        </div>
                      </td>
                      <td className="p-4">
                        {getRiskBadge(assessment.riskCategory)}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => reloadToForm(assessment)}
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900"
                          >
                            <RotateCw className="w-4 h-4" />
                            Reload
                          </button>
                          <button
                            onClick={() => exportAsPdf(assessment)}
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-100 dark:focus:ring-blue-900"
                          >
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

            {/* Pagination Footer Elements */}
            <div className="px-4 py-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-muted-foreground font-medium">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {totalRecords === 0 ? 0 : 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-foreground">
                  {totalRecords}
                </span>{" "}
                records on this page
              </div>

              <div className="flex items-center gap-2">
                {hasNextPage && (
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="inline-flex items-center justify-center p-2 px-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 transition-colors shadow-sm cursor-pointer mr-4 font-bold text-sm"
                  >
                    {isFetchingNextPage ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading...</>
                    ) : (
                      "Load More from Server"
                    )}
                  </button>
                )}

              </div>
            </div>
          </div>
          </>
        )}
      </div>

      <Sheet open={!!selectedPatientName} onOpenChange={(open) => !open && setSelectedPatientName(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto sm:border-l sm:border-slate-200">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-bold font-display">Longitudinal Trajectory</SheetTitle>
            <p className="text-sm text-muted-foreground">Patient: <span className="font-semibold text-foreground">{selectedPatientName}</span></p>
          </SheetHeader>
          
          {selectedPatientHistory.length > 0 && (
            <div className="space-y-6 pb-12">
              <HealthBadges
                badges={selectedPatientBadges}
                title="Patient improvement badges"
                description="Track earned badges for this patient's trajectory across the selected assessments."
              />
              <RiskTrendChart assessments={selectedPatientHistory} />
              
              <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Date</th>
                      <th className="p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Risk Score</th>
                      <th className="p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">BMI</th>
                      <th className="p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">HbA1c</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {selectedPatientHistory.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 whitespace-nowrap">{formatAssessmentDate(a.createdAt)}</td>
                        <td className="p-3 font-bold text-foreground">{Number(a.riskScore).toFixed(1)}%</td>
                        <td className="p-3">{Number(a.bmi).toFixed(1)}</td>
                        <td className="p-3">{Number(a.hba1cLevel).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}



