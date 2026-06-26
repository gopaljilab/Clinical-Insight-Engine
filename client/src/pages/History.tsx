import { AppLayout } from "@/components/layout/AppLayout";
import type { Assessment, AssessmentFactor } from "@shared/schema";
import { useAssessments, usePatientAssessments, useClearPatientCache, useDeleteAssessment } from "@/hooks/use-assessments";
import { format, isValid } from "date-fns";
import {
  Loader2, Activity, ChevronLeft, ChevronRight, ChevronDown,
  Upload, Download, FileDown, FileText, RotateCw, SlidersHorizontal, X
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import StatusPill from "@/components/ui/StatusPill";
import ConfidenceRange from "@/components/ui/ConfidenceRange";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { filterAssessments, type GenderFilterValue, type RiskCategoryFilterValue } from "@/utils/filterAssessments";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import RiskTrendChart, { PATIENT_COLORS } from "@/components/RiskTrendChart";
import { EmptyState } from "@/components/EmptyState";
import HealthBadges from "@/components/HealthBadges";
import { formatReadableDate } from "@/utils/dateFormat";
import { calculateHealthBadges } from "@/utils/healthBadges";
import { AssessmentSearchBar } from "@/components/AssessmentSearchBar";
import { AssessmentFilters } from "@/components/AssessmentFilters";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import AssessmentComparisonCard from "@/components/AssessmentComparisonCard";
import { downloadPatientSummaryPdf } from "@/utils/clinicalPdfReport";
import { downloadBulkAssessmentPdf } from "@/utils/bulkPdfExport";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { ApiClient } from "@/lib/apiClient";

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

const PAGE_SIZE = 10;

export default function History() {
  useEffect(() => {
    document.title = "Clinical Insight Engine - Assessment History";
  }, []);

  const { toast } = useToast();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [currentPage, setCurrentPage] = useState(1);

  // Parse sortBy into field and order for backend query
  const [sortField, sortOrder] = useMemo(() => {
    const parts = sortBy.split("-");
    const fieldMap: Record<string, string> = {
      date: "createdAt",
      risk: "riskScore",
      age: "age",
      bmi: "bmi"
    };
    return [fieldMap[parts[0]] || "createdAt", parts[1] || "desc"];
  }, [sortBy]);

  // New filter state
  const [riskCategory, setRiskCategory] = useState<RiskCategoryFilterValue>("All");
  const [gender, setGender] = useState<GenderFilterValue>("All");
  const [minAge, setMinAge] = useState<number | undefined>(undefined);
  const [maxAge, setMaxAge] = useState<number | undefined>(undefined);

  // Date filter state
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Filter drawer state
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const { data: assessmentsData, isLoading, error } = useAssessments({
    page: currentPage,
    limit: PAGE_SIZE,
    sortBy: sortField,
    order: sortOrder,
    searchTerm: searchTerm || undefined,
    riskCategory: riskCategory !== "All" ? riskCategory : undefined,
    gender: gender !== "All" ? gender : undefined,
    minAge,
    maxAge,
    startDate: startDate || undefined,
    endDate: endDate || undefined
  });

  const assessments = assessmentsData?.data ?? [];

  const { mutate: deleteAssessment } = useDeleteAssessment();

  // Refs to programmatically trigger the pop-up calendar on click
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  const [selectedPatientKey, setSelectedPatientKey] = useState<string | null>(null);
  const clearPatientCache = useClearPatientCache();

  const [compareMode, setCompareMode] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<Set<number>>(new Set());
  const [showCompareSheet, setShowCompareSheet] = useState(false);

  const toggleCompareId = (id: number) => {
    setSelectedCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  };

  const clearCompareSelection = () => {
    setSelectedCompareIds(new Set());
    setCompareMode(false);
  };

  /**
   * Build a stable per-patient key from the two fields that are recorded at
   * assessment time and never change for a real patient: name + gender.
   * Filtering by name alone would merge unrelated patients who share the same
   * name (issue #794).
   */
  const patientKey = (a: { patientName?: string | null; gender?: string | null }) =>
    `${(a.patientName || "Unknown Patient").toLowerCase().trim()}|${(a.gender || "").toLowerCase().trim()}`;

  const compareGroups = useMemo(() => {
    if (selectedCompareIds.size < 2) return [];
    const selected = assessments.filter(a => selectedCompareIds.has(a.id));
    const grouped = new Map<string, typeof selected>();
    for (const a of selected) {
      const key = patientKey(a);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(a);
    }
    return Array.from(grouped.entries()).map(([key, records], i) => ({
      key,
      patientName: key.split("|")[0],
      records,
      color: PATIENT_COLORS[i % PATIENT_COLORS.length],
    }));
  }, [selectedCompareIds, assessments, patientKey]);

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
    setCurrentPage(1);
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
    const setParam = (key: string, val: string | undefined | null) => {
      if (val && val !== "" && val !== "All") params.set(key, val);
      else params.delete(key);
    };
    setParam("filter", searchTerm || null);
    setParam("risk", riskCategory !== "All" ? riskCategory : null);
    setParam("gender", gender !== "All" ? gender : null);
    setParam("minAge", minAge !== undefined ? String(minAge) : null);
    setParam("maxAge", maxAge !== undefined ? String(maxAge) : null);
    setParam("startDate", startDate || null);
    setParam("endDate", endDate || null);
    setParam("sort", sortBy !== "date-desc" ? sortBy : null);
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [searchTerm, riskCategory, gender, minAge, maxAge, startDate, endDate, sortBy]);

  const hasActiveFilters =
    searchTerm !== "" ||
    riskCategory !== "All" ||
    gender !== "All" ||
    minAge !== undefined ||
    maxAge !== undefined ||
    startDate !== "" ||
    endDate !== "";

  const clearAllFilters = () => {
    setSearchTerm("");
    setRiskCategory("All");
    setGender("All");
    setMinAge(undefined);
    setMaxAge(undefined);
    setStartDate("");
    setEndDate("");
  };

  const activeFilterChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];
    if (searchTerm) {
      chips.push({ id: 'search', label: `Search: ${searchTerm}`, onRemove: () => setSearchTerm("") });
    }
    if (riskCategory !== "All") {
      chips.push({ id: 'risk', label: `Risk: ${riskCategory}`, onRemove: () => setRiskCategory("All") });
    }
    if (gender !== "All") {
      chips.push({ id: 'gender', label: `Gender: ${gender}`, onRemove: () => setGender("All") });
    }
    if (minAge !== undefined || maxAge !== undefined) {
      const min = minAge !== undefined ? minAge : 0;
      const max = maxAge !== undefined ? maxAge : '120+';
      chips.push({ id: 'age', label: `Age: ${min} - ${max}`, onRemove: () => { setMinAge(undefined); setMaxAge(undefined); } });
    }
    if (startDate || endDate) {
      const start = startDate ? formatReadableDate(startDate, { includeTime: false }) : "Any";
      const end = endDate ? formatReadableDate(endDate, { includeTime: false }) : "Any";
      chips.push({ id: 'date', label: `Date: ${start} - ${end}`, onRemove: () => { setStartDate(""); setEndDate(""); } });
    }
    return chips;
  }, [searchTerm, riskCategory, gender, minAge, maxAge, startDate, endDate]);

  const handleUploadLabResults = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await ApiClient.requestRaw("/api/upload/lab-results", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      toast({ title: "Success", description: data.message });
    } catch (err: unknown) {
      toast({ title: "Upload Error", description: err instanceof Error ? (err as Error).message : String(err), variant: "destructive" });
    }
    e.target.value = ''; // Reset input
  };

  const buildExportParams = () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("limit", String(Math.min(Math.max(filteredRecords || PAGE_SIZE, PAGE_SIZE), 1000)));
    params.set("sortBy", sortField);
    params.set("order", sortOrder);

    if (searchTerm) params.set("searchTerm", searchTerm);
    if (riskCategory !== "All") params.set("riskCategory", riskCategory);
    if (gender !== "All") params.set("gender", gender);
    if (minAge !== undefined) params.set("minAge", String(minAge));
    if (maxAge !== undefined) params.set("maxAge", String(maxAge));
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);

    return params;
  };

  const exportFilteredCsv = () => {
    window.location.href = `/api/assessments/export.csv?${buildExportParams().toString()}`;
  };

  const exportFilteredPdf = async () => {
    try {
      const params = buildExportParams();
      params.set("limit", "1000");
      const data = await ApiClient.get<any>(`/api/assessments/?${params.toString()}`);
      downloadBulkAssessmentPdf(data.data ?? []);
    } catch (err: unknown) {
      toast({ title: "Export Error", description: err instanceof Error ? (err as Error).message : String(err), variant: "destructive" });
    }
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

  function reloadToForm(assessment: Partial<Assessment>) {
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

  function exportAsPdf(assessment: Assessment) {
    if (!assessment) return;

    const patientName = escapeHtml(assessment.patientName || "Unknown Patient");
    const date = escapeHtml(formatReadableDate(assessment.createdAt, { fallback: "Unknown Date" }));
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

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Assessment ${escapeHtml(assessment.id ?? "Export")}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body { font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; } .container { max-width: 800px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); } h1 { color: #1e40af; margin-bottom: 20px; } .section { margin-bottom: 25px; } .section-title { font-size: 16px; font-weight: bold; color: #374151; margin-bottom: 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; } .field { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; } .label { color: #6b7280; font-weight: 500; } .value { color: #1f2937; font-weight: 600; } .risk-score { font-size: 28px; font-weight: bold; color: #dc2626; } .factors { margin-top: 15px; } .factors-list { list-style: none; padding: 0; margin: 0; }</style></head><body><div class="container"><h1>Patient Risk Assessment Report</h1><div class="section"><div class="section-title">Patient Information</div><div class="field"><span class="label">Name:</span><span class="value">${patientName}</span></div><div class="field"><span class="label">Age:</span><span class="value">${age}</span></div><div class="field"><span class="label">Assessment Date:</span><span class="value">${date}</span></div></div><div class="section"><div class="section-title">Clinical Measurements</div><div class="field"><span class="label">BMI:</span><span class="value">${bmi}</span></div><div class="field"><span class="label">HbA1c (%):</span><span class="value">${hba1cLevel}</span></div><div class="field"><span class="label">Blood Glucose (mg/dL):</span><span class="value">${bloodGlucoseLevel}</span></div><div class="field"><span class="label">Hypertension:</span><span class="value">${hypertension}</span></div><div class="field"><span class="label">Heart Disease:</span><span class="value">${heartDisease}</span></div><div class="field"><span class="label">Smoking History:</span><span class="value">${smokingHistory}</span></div></div><div class="section"><div class="section-title">Risk Assessment</div><div style="text-align: center; margin: 20px 0;"><div class="risk-score">${riskScore}</div><div style="color: #6b7280; margin-top: 5px;">Risk Category: <span style="font-weight: bold; color: #1f2937;">${category}</span></div></div></div><div class="section"><div class="section-title">Risk Factors</div><ul class="factors-list">${(
      assessment.factors || []
    )
      .slice(0, 5)
      .map((f: AssessmentFactor) => `<li>${escapeHtml(f.name || "Unknown")} — ${escapeHtml(f.description || "")} (${escapeHtml(f.impact || "N/A")})</li>`)
      .join("")}</ul></div></div></body></html>`;

    // Use Blob URL + anchor download instead of window.open + document.write:
    // - avoids deprecated document.write()
    // - works when popups are blocked (default in most modern browsers)
    // - no window.alert() needed — errors shown as in-app toast
    try {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `assessment-${assessment.id ?? "export"}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Export failed",
        description: "Could not generate the PDF export. Please try again.",
        variant: "destructive",
      });
    }
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
  // Pagination (Server-Side)
  const totalRecords = assessmentsData?.total ?? 0;
  const filteredRecords = assessmentsData?.total ?? 0;
  const totalPages = assessmentsData?.totalPages ?? 1;
  const safePage = currentPage;
  const sortedAssessments = assessments;
  const paginatedAssessments = assessments;

  // Badges computation
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
  const sortedSelectedPatientHistory = useMemo(
    () =>
      [...selectedPatientHistory].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      ),
    [selectedPatientHistory]
  );

  const handleExportPatientSummary = () => {
    if (sortedSelectedPatientHistory.length === 0) {
      toast({
        title: "No patient history available",
        description: "Select a patient with assessment history before exporting a summary.",
        variant: "destructive",
      });
      return;
    }

    downloadPatientSummaryPdf(sortedSelectedPatientHistory);
  };

  // Reset to first page when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, riskCategory, gender, minAge, maxAge, startDate, endDate, sortBy]);



  const formatAssessmentDate = (dateVal: string | Date | null | undefined) => {
    return formatReadableDate(dateVal, { fallback: "Unknown", includeTime: false });
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm) count++;
    if (riskCategory !== "All") count++;
    if (gender !== "All") count++;
    if (minAge !== undefined || maxAge !== undefined) count++;
    if (startDate || endDate) count++;
    return count;
  }, [searchTerm, riskCategory, gender, minAge, maxAge, startDate, endDate]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="text-3xl md:text-4xl font-black font-display text-foreground tracking-tight">
              Patient History
            </h1>
            <p className="text-muted-foreground mt-1 text-lg">
              Review past preventive risk assessments.
            </p>
          </div>
          <span className="text-sm font-bold bg-blue-100 text-blue-700 px-3 py-1 rounded-full border border-blue-200 shrink-0 self-start sm:self-auto">
            {filteredRecords} of {totalRecords} records
          </span>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1 min-w-0">
            <AssessmentSearchBar
              value={searchTerm}
              onSearch={setSearchTerm}
              onClear={() => setSearchTerm("")}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="default"
              onClick={() => setFilterSheetOpen(true)}
              className="gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors shadow-sm whitespace-nowrap">
              <Upload className="w-4 h-4" />
              Upload
              <input type="file" className="sr-only" accept=".csv" onChange={handleUploadLabResults} />
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={isLoading || filteredRecords === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
                >
                  <FileDown className="w-4 h-4" />
                  Export
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={exportFilteredCsv} className="cursor-pointer gap-3">
                  <Download className="w-4 h-4 text-muted-foreground" />
                  <span>Export as CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportFilteredPdf} className="cursor-pointer gap-3">
                  <FileDown className="w-4 h-4 text-muted-foreground" />
                  <span>Export as PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-card focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-600/20 transition-all duration-200 ease-in-out text-sm font-medium w-auto"
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

        {/* Quick Filter Buttons + Active Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => { setRiskCategory("High"); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              riskCategory === "High" && gender === "All" && !minAge && !maxAge && !startDate && !endDate && !searchTerm
                ? "bg-red-100 border-red-300 text-red-700"
                : "bg-card border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            High Risk
          </button>
          <button
            type="button"
            onClick={() => { setRiskCategory("Moderate"); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              riskCategory === "Moderate" && gender === "All" && !minAge && !maxAge && !startDate && !endDate && !searchTerm
                ? "bg-yellow-100 border-yellow-300 text-yellow-700"
                : "bg-card border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            Moderate Risk
          </button>
          <button
            type="button"
            onClick={() => { setSearchTerm(""); setRiskCategory("All"); setGender("All"); setMinAge(undefined); setMaxAge(undefined); setStartDate(""); setEndDate(""); setCurrentPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              !hasActiveFilters
                ? "bg-blue-100 border-blue-300 text-blue-700"
                : "bg-card border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            All Patients
          </button>
          {hasActiveFilters && activeFilterChips.length > 0 && (
            <ActiveFilterChips chips={activeFilterChips} onClearAll={clearAllFilters} />
          )}
        </div>

        {isLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid gap-6">
              <div className="h-48 rounded-3xl bg-card border border-border"></div>
              <div className="h-64 rounded-3xl bg-card border border-border"></div>
            </div>
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="h-12 bg-muted/50 border-b border-border"></div>
              <div className="divide-y divide-border">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex items-center justify-between p-4 h-16">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-4 bg-muted rounded w-32"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                    <div className="h-6 bg-muted rounded-full w-24"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-center">
            Failed to load history. Please try again later.
          </div>
        ) : totalRecords === 0 ? (
          <EmptyState
            icon={Activity}
            title={t('history.emptyState.noAssessments.title')}
            description={t('history.emptyState.noAssessments.description')}
            actionLabel={t('history.emptyState.noAssessments.actionLabel')}
            actionHref="/dashboard"
          />
        ) : filteredRecords === 0 ? (
          <EmptyState
            icon={Activity}
            title={t('history.emptyState.noMatching.title')}
            description={t('history.emptyState.noMatching.description')}
            actionLabel={t('history.emptyState.noMatching.actionLabel')}
            actionOnClick={clearAllFilters}
            secondaryActionLabel={t('history.emptyState.noMatching.secondaryActionLabel')}
            secondaryActionHref="/dashboard"
          />
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
                    {compareMode && <th className="p-4 font-semibold w-10"><span className="sr-only">Select</span></th>}
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
                      className={`hover:bg-muted/30 transition-colors text-sm ${
                        compareMode && selectedCompareIds.has(assessment.id) ? "bg-blue-50 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      {compareMode && (
                        <td className="p-4">
                          <Checkbox
                            checked={selectedCompareIds.has(assessment.id)}
                            onCheckedChange={() => toggleCompareId(assessment.id)}
                            disabled={!selectedCompareIds.has(assessment.id) && selectedCompareIds.size >= 4}
                            aria-label={`Select ${assessment.patientName}`}
                          />
                        </td>
                      )}
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
                        <div className="font-black text-base flex items-center gap-3">
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
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            <RotateCw className="w-4 h-4" />
                            Reload
                          </button>
                          <button
                            onClick={() => exportAsPdf(assessment)}
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            Export
                          </button>
                          {assessment.id && (
                            <ConfirmDeleteDialog
                              patientName={assessment.patientName || "Unknown Patient"}
                              assessmentDate={formatAssessmentDate(assessment.createdAt)}
                              onConfirm={async () => {
                                await deleteAssessment(assessment.id!);
                              }}
                            />
                          )}
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
                  {filteredRecords === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(safePage * PAGE_SIZE, filteredRecords)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-foreground">
                  {filteredRecords}
                </span>{" "}
                filtered records (page {safePage} of {totalPages})
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center justify-center p-2 px-3 rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-30 transition-colors shadow-sm"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Prev
                </button>
                <span className="text-sm text-muted-foreground font-medium px-2">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center justify-center p-2 px-3 rounded-xl border border-border bg-card text-foreground hover:bg-muted disabled:opacity-30 transition-colors shadow-sm"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>
          </>
        )}
      </div>

      {/* Filter Drawer */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto sm:border-l sm:border-slate-200">
          <SheetHeader className="mb-6">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-bold font-display">Filters</SheetTitle>
              <SheetClose className="rounded-full p-2 hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </SheetClose>
            </div>
            <p className="text-sm text-muted-foreground">
              Narrow down patient records by risk, demographics, and date.
            </p>
          </SheetHeader>
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
          {hasActiveFilters && (
            <div className="mt-6 pt-4 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => { clearAllFilters(); setFilterSheetOpen(false); }} className="w-full gap-2">
                <X className="h-4 w-4" />
                Clear all filters
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={showCompareSheet} onOpenChange={(open) => !open && setShowCompareSheet(false)}>
        <SheetContent className="w-full sm:max-w-4xl overflow-y-auto sm:border-l sm:border-slate-200">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-bold font-display">Patient Comparison</SheetTitle>
            <p className="text-sm text-muted-foreground">
              Comparing {compareGroups.length} patients ({selectedCompareIds.size} assessments selected)
            </p>
          </SheetHeader>

          {compareGroups.length >= 2 && (
            <ScrollArea className="h-[calc(100vh-12rem)]">
              <div className="space-y-8 pb-12 pr-2">
                {/* Risk Trend Chart */}
                <RiskTrendChart
                  assessments={[]}
                  patientGroups={compareGroups.map(g => ({
                    patientName: g.patientName,
                    assessments: g.records,
                    color: g.color,
                  }))}
                />

                {/* Side-by-side latest metrics table */}
                <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-muted/50 border-b border-border px-4 py-3">
                    <h3 className="text-base font-bold text-foreground">Latest Metrics Comparison</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-muted/30 border-b border-border">
                        <tr>
                          <th className="p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Metric</th>
                          {compareGroups.map(g => (
                            <th key={g.key} className="p-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">
                              <span className="inline-flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: g.color }} />
                                {g.patientName}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {[
                          { label: "Age", get: (r: Assessment[]) => r[0]?.age ?? "—" },
                          { label: "BMI", get: (r: Assessment[]) => Number(r[0]?.bmi ?? 0).toFixed(1) },
                          { label: "HbA1c (%)", get: (r: Assessment[]) => `${Number(r[0]?.hba1cLevel ?? 0).toFixed(1)}%` },
                          { label: "Blood Glucose", get: (r: Assessment[]) => Number(r[0]?.bloodGlucoseLevel ?? 0).toFixed(0) },
                          { label: "Hypertension", get: (r: Assessment[]) => (r[0]?.hypertension ? "Yes" : "No") },
                          { label: "Heart Disease", get: (r: Assessment[]) => (r[0]?.heartDisease ? "Yes" : "No") },
                          { label: "Smoking", get: (r: Assessment[]) => r[0]?.smokingHistory ?? "—" },
                          { label: "Risk Score", get: (r: Assessment[]) => `${Number(r[0]?.riskScore ?? 0).toFixed(1)}%` },
                          { label: "Risk Category", get: (r: Assessment[]) => r[0]?.riskCategory ?? "—" },
                        ].map(row => (
                          <tr key={row.label} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-semibold text-muted-foreground whitespace-nowrap">{row.label}</td>
                            {compareGroups.map(g => {
                              const sorted = [...g.records].sort(
                                (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                              );
                              return (
                                <td key={g.key} className="p-3 text-foreground font-medium whitespace-nowrap">
                                  {row.get(sorted)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Health badges per patient */}
                <div className="grid gap-6 md:grid-cols-2">
                  {compareGroups.map(g => {
                    const sorted = [...g.records].sort(
                      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                    );
                    const badges = calculateHealthBadges(sorted[0], sorted);
                    return (
                      <HealthBadges
                        key={g.key}
                        badges={badges}
                        title={`${g.patientName}`}
                        description="Health improvement badges based on available assessments."
                      />
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedPatientName} onOpenChange={(open) => !open && setSelectedPatientKey(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto sm:border-l sm:border-slate-200">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-bold font-display">Longitudinal Trajectory</SheetTitle>
            <p className="text-sm text-muted-foreground">Patient: <span className="font-semibold text-foreground">{selectedPatientName}</span></p>
          </SheetHeader>
          
          {selectedPatientHistory.length > 0 && (
            <div className="space-y-6 pb-12">
              <button
                type="button"
                onClick={handleExportPatientSummary}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 sm:w-auto"
              >
                <FileText className="h-4 w-4" />
                Export Patient Summary PDF
              </button>

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
