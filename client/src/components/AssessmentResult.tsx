import { useMemo, useState, useEffect } from "react";
import { type AssessmentResponse } from "@shared/routes";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { AlertCircle, FileText, CheckCircle2, TrendingUp, TrendingDown, Info, HeartPulse, Activity, UserCircle, Stethoscope, Eye, Share2, Loader2, Printer, Download, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { HealthBadges } from "@/components/HealthBadges";
import { CopySummaryButton } from "@/components/CopySummaryButton";
import { useAssessments, useWhatIfAuto, useUpdateClinicalNote } from "@/hooks/use-assessments";
import { calculateHealthBadges } from "@/utils/healthBadges";
import { downloadClinicalAssessmentPdf } from "@/utils/clinicalPdfReport";
import { PatientPresentationMode } from "./PatientPresentationMode";
import { WhatIfRiskSimulator } from "./WhatIfRiskSimulator";
import { Recommendations } from "./Recommendations";
import { PredictionExplanation } from "./PredictionExplanation";
import { DataQualityAlerts } from "./DataQualityAlerts";
import { BiomarkerAlerts } from "./BiomarkerAlerts";
import { ClinicalAttentionNavigator } from "./ClinicalAttentionNavigator";
import { ClinicalCopilot } from "./ClinicalCopilot";
import { ClinicalNoteViewer } from "./ClinicalNoteViewer";
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

interface FactorBreakdown extends RiskFactor {
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
            <button
              type="button"
              onClick={generatePDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
            >
              {isGeneratingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {isGeneratingPDF ? t("patientResult.generating") : t("patientResult.exportOfficial")}
            </button>
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

              <ExplainabilityPanel
                factors={factorBreakdown}
                increasedRiskFactors={increasedRiskFactors}
                reducedRiskFactors={reducedRiskFactors}
              />

              <PredictionExplanation explanation={assessment.explanation} view="clinician" />

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

function ExplainabilityPanel({
  factors,
  increasedRiskFactors,
  reducedRiskFactors,
}: {
  factors: FactorBreakdown[];
  increasedRiskFactors: FactorBreakdown[];
  reducedRiskFactors: FactorBreakdown[];
}) {
  const { t } = useTranslation();
  if (factors.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" /> {t("patientResult.explainability")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("patientResult.explainabilityDesc")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
            <TrendingUp className="w-3.5 h-3.5" />
            {increasedRiskFactors.length} {t("patientResult.raised")}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-green-700">
            <TrendingDown className="w-3.5 h-3.5" />
            {reducedRiskFactors.length} {t("patientResult.reduced")}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {factors.map((factor) => {
          const increasesRisk = factor.impact === "positive";
          return (
            <div
              key={`${factor.name}-${factor.impact}`}
              className="rounded-lg border border-border/70 bg-muted/20 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{factor.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{factor.plainReason}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold",
                    increasesRisk
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-green-50 text-green-700 border border-green-200"
                  )}
                >
                  {increasesRisk ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {increasesRisk ? t("patientResult.increasesRisk") : t("patientResult.reducesRisk")}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1.5">
                  <span>{t("patientResult.relativeContribution")}</span>
                  <span>{factor.strength}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full w-[var(--factor-strength)]", increasesRisk ? "bg-red-500" : "bg-green-500")}
                    style={{ '--factor-strength': `${factor.strength}%` } as React.CSSProperties}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PathToImprovement({ assessment }: { assessment: AssessmentResponse }) {
  const { t } = useTranslation();
  const { mutate, data, isPending } = useWhatIfAuto();

  useEffect(() => {
    if (!assessment) return;
    mutate({
      patientName: assessment.patientName ?? "Unknown",
      gender: (assessment.gender as "Male" | "Female") || "Male",
      age: assessment.age ?? 0,
      hypertension: assessment.hypertension ?? false,
      heartDisease: assessment.heartDisease ?? false,
      smokingHistory: (assessment.smokingHistory as "current" | "never" | "No Info" | "former") || "No Info",
      bmi: assessment.bmi ?? 25,
      hba1cLevel: assessment.hba1cLevel ?? 5.5,
      bloodGlucoseLevel: assessment.bloodGlucoseLevel ?? 100,
    });
  }, [assessment, mutate]);

  if (isPending || !data) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm animate-pulse flex items-center justify-center min-h-[100px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground text-sm">{t("patientResult.analyzing")}</span>
      </div>
    );
  }

  const recommendations = (data as any)?.recommendations;
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-100 border border-green-200 rounded-xl p-6 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <TrendingDown className="w-24 h-24 text-green-700" />
      </div>
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-green-900 relative z-10">
        <TrendingDown className="w-5 h-5" /> {t("patientResult.pathToImprovement")}
      </h3>
      <div className="space-y-4 relative z-10">
        {recommendations.map((rec: any, idx: number) => (
          <div key={idx} className="bg-white/80 backdrop-blur-sm p-4 rounded-lg border border-green-200/50 flex gap-3 shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-900">{rec.action}</p>
              <p className="text-green-800/80 text-sm mt-1">{rec.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
