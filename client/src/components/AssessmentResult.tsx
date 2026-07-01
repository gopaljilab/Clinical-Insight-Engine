import React, { useMemo, useState, useEffect } from "react";
import { type AssessmentResponse } from "@shared/routes";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { AlertCircle, FileText, CheckCircle2, TrendingUp, TrendingDown, Info, HeartPulse, Activity, UserCircle, Stethoscope, Eye, Share2, Loader2, Printer, Download, MonitorPlay, Pencil, X, Save, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { HealthBadges } from "@/components/HealthBadges";
import { CopySummaryButton } from "@/components/CopySummaryButton";
import { useAssessments, useWhatIfAuto, useUpdateClinicalNote, usePatientAssessments } from "@/hooks/use-assessments";
import { calculateHealthBadges } from "@/utils/healthBadges";
import { downloadClinicalAssessmentPdf, downloadPatientHandoutPdf } from "@/utils/clinicalPdfReport";
import { PatientPresentationMode } from "./PatientPresentationMode";
import { WhatIfRiskSimulator } from "./WhatIfRiskSimulator";
import { Recommendations } from "./Recommendations";
import { PredictionExplanation } from "./PredictionExplanation";
import { DataQualityAlerts } from "./DataQualityAlerts";
import { BiomarkerAlerts } from "./BiomarkerAlerts";
import { ClinicalAttentionNavigator } from "./ClinicalAttentionNavigator";
import { ClinicalCopilot } from "./ClinicalCopilot";
import { ClinicalNoteViewer } from "./ClinicalNoteViewer";
import { ExplainabilityPanel } from "./assessment/ExplainabilityPanel";
import { CollaborativeNotes } from "./CollaborativeNotes";
import { PathToImprovement } from "./assessment/PathToImprovement";
import { Tooltip as UiTooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";

interface AssessmentResultProps {
  assessment: AssessmentResponse;
}

interface RiskFactor {
  name: string;
  impact: "positive" | "negative" | string;
  description: string;
}

export interface FactorBreakdown extends RiskFactor {
  strength: number;
  plainReason: string;
}

const factorReasoning: Record<string, string> = {
  age: "factorReasoning.age",
  bmi: "factorReasoning.bmi",
  "hba1c level": "factorReasoning.hba1c",
  "blood glucose level": "factorReasoning.glucose",
  hypertension: "factorReasoning.hypertension",
  "heart disease": "factorReasoning.heartDisease",
  "smoking history": "factorReasoning.smoking",
  gender: "factorReasoning.gender",
};

const normalizeFactors = (rawFactors: AssessmentResponse["factors"]): RiskFactor[] => {
  if (typeof rawFactors === "string") {
    try {
      const parsed = JSON.parse(rawFactors);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return Array.isArray(rawFactors) ? rawFactors as RiskFactor[] : [];
};

const getFactorReason = (factor: RiskFactor, t: (key: string) => string) => {
  const key = factor?.name?.trim()?.toLowerCase() || "";
  const translatedKey = factorReasoning[key];
  return translatedKey ? t(translatedKey) : factor.description;
};

export function AssessmentResult({ assessment }: AssessmentResultProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<"patient" | "clinician">("patient");
  const [isPresenting, setIsPresenting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingPatientPDF, setIsGeneratingPatientPDF] = useState(false);
  const [pdfError, setPdfError] = useState<string>("");
  const [whatIfFactors, setWhatIfFactors] = useState<{ name: string; impact: string; description: string }[] | null>(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNoteText, setEditNoteText] = useState("");
  const updateNoteMutation = useUpdateClinicalNote();

  const generatePDF = async () => {
    setPdfError("");
    setIsGeneratingPDF(true);
    try {
      await downloadClinicalAssessmentPdf(assessment);
    } catch (error) {
      console.error("PDF export failed", error);
      setPdfError(t("patientResult.pdfError"));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const generatePatientPDF = async (factorBreakdown: any[], patientGuidance: string[]) => {
    setPdfError("");
    setIsGeneratingPatientPDF(true);
    try {
      await downloadPatientHandoutPdf(assessment, factorBreakdown, patientGuidance, t);
    } catch (error) {
      console.error("Patient PDF export failed", error);
      setPdfError(t("patientResult.pdfError"));
    } finally {
      setIsGeneratingPatientPDF(false);
    }
  };

  const exportToJson = () => {
    const blob = new Blob([JSON.stringify(assessment, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diabetes-risk-assessment-${assessment.id ?? "report"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRiskColor = (category?: string | null) => {
    if (!category) return "text-blue-600 bg-blue-50 border-blue-200";
    switch (category.toUpperCase()) {
      case "LOW": return "text-green-600 bg-green-50 border-green-200";
      case "MODERATE": return "text-amber-600 bg-amber-50 border-amber-200";
      case "HIGH": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-blue-600 bg-blue-50 border-blue-200";
    }
  };

  const getRiskColorHex = (category: string) => {
    switch (category.toUpperCase()) {
      case "LOW": return "#16a34a";
      case "MODERATE": return "#d97706";
      case "HIGH": return "#dc2626";
      default: return "#2563eb";
    }
  };

  const { data: assessmentsResponse } = useAssessments();
  const assessmentHistory = assessmentsResponse?.data ?? [];
  const improvementBadges = useMemo(
    () => calculateHealthBadges(assessment, assessmentHistory),
    [assessment, assessmentHistory]
  );

  const { data: patientAssessmentsResponse } = usePatientAssessments(assessment.patientName);
  const patientHistory = useMemo(() => {
    const history = patientAssessmentsResponse?.pages.flatMap(page => page.data) ?? [];
    return history.sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
  }, [patientAssessmentsResponse]);

  const timelineData = useMemo(() => {
    return patientHistory.map(a => {
      // Extract interventions from clinicianAdvice or patientAdvice if it's the current one, else standard
      const interventions = a.prediction?.clinicianAdvice ?? [];
      const hasIntervention = interventions.length > 0;
      return {
        date: new Date(a.createdAt!).toLocaleDateString(),
        riskScore: Number(a.riskScore).toFixed(1),
        hba1cLevel: (a as any).hba1cLevel ?? 0,
        interventions,
        hasIntervention,
        riskCategory: a.riskCategory
      };
    });
  }, [patientHistory]);

  const factors = normalizeFactors(assessment.factors);
  const totalFactors = Math.max(factors.length, 1);
  const factorBreakdown: FactorBreakdown[] = factors.map((factor, index) => ({
    ...factor,
    strength: Math.max(20, Math.round(((totalFactors - index) / totalFactors) * 100)),
    plainReason: getFactorReason(factor, t),
  }));
  const increasedRiskFactors = factorBreakdown.filter((factor) => factor.impact === "positive");
  const reducedRiskFactors = factorBreakdown.filter((factor) => factor.impact !== "positive");

  const chartData = factorBreakdown.map((f) => ({
    name: f.name,
    value: f.impact === 'positive' ? f.strength : -f.strength,
    impact: f.impact,
    description: f.description,
    plainReason: f.plainReason,
    strength: f.strength,
  }));

  const whatIfChartData = useMemo(() => {
    if (!whatIfFactors) return null;
    const maxStrength = Math.max(whatIfFactors.length, 1);
    return whatIfFactors.map((f, i) => ({
      name: f.name,
      value: f.impact === 'positive' ? Math.round(((maxStrength - i) / maxStrength) * 100) : -Math.round(((maxStrength - i) / maxStrength) * 100),
      impact: f.impact,
      description: f.description,
      isWhatIf: true,
    }));
  }, [whatIfFactors]);

  const riskScore = Number(assessment.riskScore).toFixed(1);
  const positiveFactors = factors.filter((f: any) => f.impact === "positive");
  const protectiveFactors = factors.filter((f: any) => f.impact !== "positive");
  const patientGuidance = assessment.prediction?.patientAdvice ?? [
    t("patientResult.guidance1"),
    t("patientResult.guidance2"),
    t("patientResult.guidance3"),
  ];
  const clinicianActions = assessment.prediction?.clinicianAdvice ?? [
    t("patientResult.clinicianAction1"),
    t("patientResult.clinicianAction2"),
    t("patientResult.clinicianAction3"),
  ];

  return (
    <motion.div 
      id="assessment-result-wrapper"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/60 flex flex-col"
    >
      {/* Header/Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 bg-muted/30 p-2.5">
        <div className="relative flex flex-1 max-w-md bg-muted/65 p-1 gap-1 rounded-xl">
          <button
            onClick={() => setView("patient")}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold z-10 transition-colors rounded-lg focus:outline-none",
              view === "patient" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <UserCircle className="w-4 h-4" />
            {t("patientResult.patientView")}
            {view === "patient" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-background rounded-lg border border-border/50 shadow-sm z-[-1]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => setView("clinician")}
            className={cn(
              "relative flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold z-10 transition-colors rounded-lg focus:outline-none",
              view === "clinician" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Stethoscope className="w-4 h-4" />
            {t("patientResult.clinicianView")}
            {view === "clinician" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-background rounded-lg border border-border/50 shadow-sm z-[-1]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        </div>

        <div className="pdf-hide-buttons flex flex-col gap-2 justify-end self-stretch print:hidden">
          <div className="flex flex-wrap gap-2 items-center justify-end">
            <button
              type="button"
              onClick={() => setIsPresenting(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all duration-200 active:scale-[0.98]"
            >
              <MonitorPlay className="w-3.5 h-3.5" />
              {t("patientResult.present")}
            </button>
            {view === "clinician" ? (
              <button
                type="button"
                onClick={generatePDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
              >
                {isGeneratingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                {isGeneratingPDF ? t("patientResult.generating") : t("patientResult.exportOfficial")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => generatePatientPDF(factorBreakdown, patientGuidance)}
                disabled={isGeneratingPatientPDF}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
              >
                {isGeneratingPatientPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                {isGeneratingPatientPDF ? t("patientResult.generating") : (t("patientResult.exportPatientHandout") || "Download Patient PDF")}
              </button>
            )}
            <UiTooltip>
              <TooltipTrigger asChild>
                <div>
                  <CopySummaryButton assessment={assessment} iconOnly />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("patientResult.copySummary")}</p>
              </TooltipContent>
            </UiTooltip>
            <UiTooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={exportToJson}
                  className="flex items-center justify-center w-9 h-9 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-sm shadow-sm transition-all duration-200 active:scale-[0.98]"
                  aria-label={t("patientResult.exportJson")}
                >
                  <Download className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("patientResult.exportJson")}</p>
              </TooltipContent>
            </UiTooltip>
            <UiTooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center justify-center w-9 h-9 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-sm shadow-sm transition-all duration-200 active:scale-[0.98]"
                  aria-label={t("patientResult.printReport")}
                >
                  <Printer className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("patientResult.printReport")}</p>
              </TooltipContent>
            </UiTooltip>
          </div>
          {pdfError ? (
            <p role="alert" className="text-sm text-red-600 mt-1">
              {pdfError}
            </p>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {isPresenting && (
          <PatientPresentationMode 
            assessment={assessment} 
            onClose={() => setIsPresenting(false)} 
          />
        )}
      </AnimatePresence>

      <div className="p-6 md:p-8">
        <AnimatePresence mode="wait">
          {view === "patient" ? (
            <motion.div
              key="patient"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="space-y-8"
            >
              {/* Patient Hero */}
              <div className="text-center space-y-4 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary">
                  <UserCircle className="h-4 w-4" />
                  {t("patientResult.plainLanguage")}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">{t("patientResult.yourHealthAssessment")}</h2>
                <div className={cn("inline-flex flex-col items-center justify-center w-36 h-36 sm:w-48 sm:h-48 rounded-full border-8 shadow-inner", getRiskColor(assessment.riskCategory))}>
                  <span className="text-sm font-bold uppercase tracking-widest opacity-80 mb-1">{t("patientResult.riskLevel")}</span>
                  <span className="text-3xl sm:text-4xl font-display font-black">{assessment.riskCategory}</span>
                </div>
                <p className="text-muted-foreground text-lg">
                  {t("patientResult.basedOnInfo")}<strong>{assessment?.riskCategory?.toLowerCase() ?? "unknown"}</strong>.
                </p>
              </div>

              <HealthBadges
                badges={improvementBadges}
                title={t("patientResult.progressBadges")}
                description={t("patientResult.progressBadgesDesc")}
              />

              <DataQualityAlerts alerts={assessment.qualityAlerts} />

              {/* Patient Key Insights */}
              <div className="bg-secondary/50 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" /> {t("patientResult.whatThisMeans")}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {factorBreakdown.map((factor, i) => (
                    <div key={i} className="flex gap-3 bg-card p-4 rounded-lg shadow-sm border border-border/50">
                      {factor.impact === 'positive' ? (
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="font-semibold text-foreground">{factor.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">{factor.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {patientGuidance.map((item, index) => (
                  <div key={item} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>

              <Recommendations recommendations={assessment.recommendations} audience="patient" />

              <PathToImprovement assessment={assessment} />
              <PredictionExplanation explanation={assessment.explanation} view="patient" />

              <BiomarkerAlerts alerts={(assessment as any).biomarkerAlerts ?? (assessment as any).alerts ?? undefined} />

              <WhatIfRiskSimulator assessment={assessment} onComparisonFactors={setWhatIfFactors} />

              <ClinicalCopilot assessment={assessment} />

              <ExplainabilityPanel
                factors={factorBreakdown}
                increasedRiskFactors={increasedRiskFactors}
                reducedRiskFactors={reducedRiskFactors}
              />
            </motion.div>
          ) : (
            <motion.div
              key="clinician"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="space-y-8"
            >
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">{t("patientResult.clinicianDecision")}</p>
                    <h2 className="mt-1 text-2xl font-bold text-foreground">{t("patientResult.detailedInterpretation")}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      {t("patientResult.clinicianViewDesc")}
                    </p>
                  </div>
                  <div className={cn("inline-flex w-fit rounded-full border px-3 py-1 text-sm font-bold", getRiskColor(assessment.riskCategory))}>
                    {assessment.riskCategory} {t("patientResult.riskLabel")}
                  </div>
                </div>
              </div>

              {/* Clinician Top Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t("patientResult.predictedRisk")}</p>
                  <p className="text-3xl font-bold font-display flex items-baseline gap-1">
                    {riskScore}<span className="text-xl text-muted-foreground">%</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("patientResult.modelProbability")}
                    {assessment.confidenceInterval && (
                      <span className="block text-[10px] mt-0.5 opacity-80">
                        (95% CI: {assessment.confidenceInterval})
                      </span>
                    )}
                  </p>
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t("assessment.riskCategory")}</p>
                  <div className={cn("inline-flex px-3 py-1 rounded-full text-sm font-bold mt-1", getRiskColor(assessment.riskCategory))}>
                    {assessment.riskCategory}
                  </div>
                  {assessment.modelConfidence && (
                    <p className="text-[10px] text-muted-foreground mt-2 italic">
                      {t("patientResult.modelConfidenceLabel")}: {Number(assessment.modelConfidence).toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-1">{t("patientResult.vitalsSummary")}</p>
                  <div className="flex flex-col sm:flex-row gap-4 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">BMI</p>
                      <p className="font-semibold">{assessment?.bmi ?? "--"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">HbA1c</p>
                      <p className="font-semibold">{assessment?.hba1cLevel ? `${assessment.hba1cLevel}%` : "--"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Glucose</p>
                      <p className="font-semibold">{assessment?.bloodGlucoseLevel ?? "--"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <DataQualityAlerts alerts={assessment.qualityAlerts} />
                <ClinicalAttentionNavigator navigator={assessment.attentionNavigator} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 font-bold">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    {t("patientResult.riskDrivingFactors")}
                  </h3>
                  <div className="space-y-3">
                    {positiveFactors.length > 0 ? positiveFactors.map((factor: any) => (
                      <div key={factor.name} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                        <p className="font-semibold">{factor.name}</p>
                        <p className="mt-1 text-amber-900/80">{factor.description}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">{t("patientResult.noRiskDriving")}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 font-bold">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    {t("patientResult.protectiveSignals")}
                  </h3>
                  <div className="space-y-3">
                    {protectiveFactors.length > 0 ? protectiveFactors.map((factor: any) => (
                      <div key={factor.name} className="rounded-lg bg-green-50 p-3 text-sm text-green-950">
                        <p className="font-semibold">{factor.name}</p>
                        <p className="mt-1 text-green-900/80">{factor.description}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">{t("patientResult.noProtectiveSignals")}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Clinician Chart */}
              <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" /> {t("patientResult.factorCoefficient")}
                  </h3>
                  {whatIfChartData && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 text-xs font-semibold">
                      {t("patientResult.whatIfActive")}
                    </span>
                  )}
                </div>
                <div className="h-56 sm:h-64 w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={whatIfChartData ?? chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <ReferenceLine x={0} stroke="hsl(var(--border))" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={130} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-popover text-popover-foreground border border-border p-3 rounded-lg shadow-xl text-sm max-w-xs">
                                        <p className="font-bold mb-1">{data.name}</p>
                                        <p className="text-muted-foreground">{data.description}</p>
                                        {!data.isWhatIf && <p className="text-muted-foreground mt-2">{data.plainReason}</p>}
                                        <p className={cn("mt-2 font-semibold", data.impact === 'positive' ? 'text-red-500' : 'text-green-500')}>
                                          {t("patientResult.impactLabel")}: {data.impact === 'positive' ? t("patientResult.increasesRisk") : t("patientResult.reducesRisk")}
                                        </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {(whatIfChartData ?? chartData).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.impact === 'positive' ? '#ef4444' : '#22c55e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Longitudinal Risk Tracking Chart */}
              {timelineData.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" /> Longitudinal Patient Risk Tracking
                    </h3>
                  </div>
                  <div className="h-64 sm:h-80 w-full overflow-x-auto">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} dy={10} />
                        <YAxis yAxisId="left" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} label={{ value: 'Risk Score (%)', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))' } }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} label={{ value: 'HbA1c', angle: 90, position: 'insideRight', style: { fill: 'hsl(var(--muted-foreground))' } }} />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-popover text-popover-foreground border border-border p-3 rounded-lg shadow-xl text-sm max-w-xs z-50">
                                  <p className="font-bold mb-2 text-primary">{label}</p>
                                  <p className="font-semibold flex justify-between gap-4">
                                    <span>Risk Score:</span>
                                    <span className={getRiskColor(data.riskCategory)}>{data.riskScore}%</span>
                                  </p>
                                  <p className="font-semibold flex justify-between gap-4 mt-1">
                                    <span>HbA1c Level:</span>
                                    <span>{data.hba1cLevel}</span>
                                  </p>
                                  {data.hasIntervention && (
                                    <div className="mt-3 pt-3 border-t border-border">
                                      <p className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1">Interventions / Recommendations</p>
                                      <ul className="list-disc pl-4 space-y-1 text-xs">
                                        {data.interventions.map((intervention: string, i: number) => (
                                          <li key={i}>{intervention}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Line 
                          yAxisId="left" 
                          type="monotone" 
                          dataKey="riskScore" 
                          name="Risk Score" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          activeDot={{ r: 8 }}
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (payload.hasIntervention) {
                              return (
                                <svg x={cx - 6} y={cy - 6} width={12} height={12} fill="#ef4444" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10" />
                                </svg>
                              );
                            }
                            return <circle cx={cx} cy={cy} r={4} fill="#3b82f6" />;
                          }}
                        />
                        <Line 
                          yAxisId="right" 
                          type="monotone" 
                          dataKey="hba1cLevel" 
                          name="HbA1c" 
                          stroke="#8b5cf6" 
                          strokeDasharray="5 5" 
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#8b5cf6' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <ExplainabilityPanel
                factors={factorBreakdown}
                increasedRiskFactors={increasedRiskFactors}
                reducedRiskFactors={reducedRiskFactors}
              />

              <PredictionExplanation explanation={assessment.explanation} view="clinician" />
              
              <div className="mt-8">
                <CollaborativeNotes assessmentId={assessment.id} />
              </div>

              <BiomarkerAlerts alerts={(assessment as any).biomarkerAlerts ?? (assessment as any).alerts ?? undefined} />

              <div className="rounded-xl border border-border bg-muted/30 p-5">
                <h3 className="mb-4 font-bold">{t("patientResult.suggestedFollowUp")}</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {clinicianActions.map((action) => (
                    <div key={action} className="rounded-lg border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
                      {action}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <Recommendations recommendations={assessment.recommendations} audience="clinician" />
              </div>

              <ClinicalCopilot assessment={assessment} />

              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    {t("patientResult.yourHealthAssessment")}
                  </h3>
                  {!isEditingNote && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditNoteText(assessment.clinicalNote ?? "");
                        setIsEditingNote(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      {assessment.clinicalNote ? t("patientResult.editNote") || "Edit" : t("patientResult.addNote") || "Add Note"}
                    </button>
                  )}
                </div>

                {isEditingNote ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editNoteText}
                      onChange={(e) => setEditNoteText(e.target.value)}
                      placeholder="Enter clinical notes..."
                      className="min-h-[120px] font-mono text-sm"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingNote(false);
                          setEditNoteText("");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateNoteMutation.mutate(
                            { id: assessment.id!, clinicalNote: editNoteText },
                            { onSuccess: () => setIsEditingNote(false) }
                          );
                        }}
                        disabled={updateNoteMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {updateNoteMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        Save
                      </button>
                    </div>
                  </div>
                ) : assessment.clinicalNote && assessment.explainableInsights ? (
                  <ClinicalNoteViewer
                    noteText={assessment.clinicalNote}
                    insights={assessment.explainableInsights as any}
                  />
                ) : assessment.clinicalNote ? (
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="whitespace-pre-wrap leading-relaxed text-sm">{assessment.clinicalNote}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t("patientResult.noClinicalNotes") || "No clinical notes recorded for this assessment."}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

