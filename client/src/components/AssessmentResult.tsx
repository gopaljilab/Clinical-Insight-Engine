import { useMemo, useState } from "react";
import { type AssessmentResponse } from "@shared/routes";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import { AlertCircle, CheckCircle2, Info, Activity, Stethoscope, UserCircle, TrendingDown, TrendingUp, Download, Printer, MonitorPlay, FileText, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { HealthBadges } from "@/components/HealthBadges";
import { CopySummaryButton } from "@/components/CopySummaryButton";
import { useAssessments } from "@/hooks/use-assessments";
import { calculateHealthBadges } from "@/utils/healthBadges";
import { downloadClinicalAssessmentPdf } from "@/utils/clinicalPdfReport";
import { PatientPresentationMode } from "./PatientPresentationMode";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

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
  age: "Risk changes with age because blood vessels and metabolic control can become less resilient over time.",
  bmi: "BMI helps estimate weight-related strain that can influence blood pressure, insulin resistance, and heart workload.",
  "hba1c level": "HbA1c reflects longer-term blood sugar control, so higher values can point to sustained metabolic stress.",
  "blood glucose level": "Blood glucose shows the current sugar level, which can reinforce or soften the overall diabetes risk signal.",
  hypertension: "High blood pressure increases cardiovascular strain and can raise the chance of future heart complications.",
  "heart disease": "Prior heart disease is a strong clinical history marker and usually increases baseline cardiovascular risk.",
  "smoking history": "Smoking history affects blood vessels and inflammation, so current or past exposure can shift risk upward.",
  gender: "Sex-linked population patterns can slightly shift the model's baseline risk estimate.",
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

const getFactorReason = (factor: RiskFactor) => {
  const key = factor.name.trim().toLowerCase();
  return factorReasoning[key] ?? factor.description;
};

export function AssessmentResult({ assessment }: AssessmentResultProps) {
  const [view, setView] = useState<"patient" | "clinician">("patient");
  const [isPresenting, setIsPresenting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const element = document.getElementById("assessment-result-wrapper");
      if (!element) return;
      
      const buttons = element.querySelector('.pdf-hide-buttons') as HTMLElement;
      const originalDisplay = buttons ? buttons.style.display : '';
      if (buttons) buttons.style.display = 'none';

      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      if (buttons) buttons.style.display = originalDisplay;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Clinical_Insight_Report_${assessment.patientName?.replace(/\s+/g, '_') ?? 'Patient'}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
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

  const getRiskColor = (category: string) => {
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
  const assessmentHistory = useMemo(
    () => assessmentsResponse?.data ?? [],
    [assessmentsResponse]
  );
  const improvementBadges = useMemo(
    () => calculateHealthBadges(assessment, assessmentHistory),
    [assessment, assessmentHistory]
  );

  const factors = normalizeFactors(assessment.factors);
  const totalFactors = Math.max(factors.length, 1);
  const factorBreakdown: FactorBreakdown[] = factors.map((factor, index) => ({
    ...factor,
    strength: Math.max(20, Math.round(((totalFactors - index) / totalFactors) * 100)),
    plainReason: getFactorReason(factor),
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

  const riskScore = Number(assessment.riskScore).toFixed(1);
  const positiveFactors = factors.filter((f: any) => f.impact === "positive");
  const protectiveFactors = factors.filter((f: any) => f.impact !== "positive");
  const patientGuidance = assessment.prediction?.patientAdvice ?? [
    "Review these results with a qualified clinician before making medical decisions.",
    "Focus first on the highlighted risk factors that can be changed through care planning.",
    "Track BMI, HbA1c, and blood glucose over time so future assessments have context.",
  ];
  const clinicianActions = assessment.prediction?.clinicianAdvice ?? [
    "Confirm risk category against the patient's full history and current medication profile.",
    "Use the factor breakdown to prioritize follow-up labs, counselling, or referrals.",
    "Compare this assessment with prior visits to identify meaningful trajectory changes.",
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
            className={`relative flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold z-10 transition-colors rounded-lg focus:outline-none ${
              view === "patient" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserCircle className="w-4 h-4" />
            Patient View
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
            className={`relative flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold z-10 transition-colors rounded-lg focus:outline-none ${
              view === "clinician" 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            Clinician View
            {view === "clinician" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-background rounded-lg border border-border/50 shadow-sm z-[-1]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        </div>
        <div className="pdf-hide-buttons flex items-center gap-2 justify-end self-stretch print:hidden">
          <button
            type="button"
            onClick={() => setIsPresenting(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-900 text-white hover:bg-slate-800 shadow-sm transition-all duration-200 active:scale-[0.98]"
          >
            <MonitorPlay className="w-3.5 h-3.5" />
            Present
          </button>
          <button
            type="button"
            onClick={generatePDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
          >
            {isGeneratingPDF ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            {isGeneratingPDF ? "Generating..." : "Download PDF"}
          </button>
          <CopySummaryButton assessment={assessment} />
          <button
            type="button"
            onClick={exportToJson}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-sm shadow-sm transition-all duration-200 active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5" />
            JSON
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:shadow-sm shadow-sm transition-all duration-200 active:scale-[0.98]"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
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
              className="space-y-8"
            >
              {/* Patient Hero */}
              <div className="text-center space-y-4 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary">
                  <UserCircle className="h-4 w-4" />
                  Plain-language summary
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Your Health Assessment</h2>
                <div className={`inline-flex flex-col items-center justify-center w-36 h-36 sm:w-48 sm:h-48 rounded-full border-8 shadow-inner ${getRiskColor(assessment.riskCategory)}`}>
                  <span className="text-sm font-bold uppercase tracking-widest opacity-80 mb-1">Risk Level</span>
                  <span className="text-3xl sm:text-4xl font-display font-black">{assessment.riskCategory}</span>
                </div>
                <p className="text-muted-foreground text-lg">
                  Based on your provided information, your preventive diabetes risk is considered <strong>{assessment.riskCategory.toLowerCase()}</strong>.
                </p>
              </div>

              <HealthBadges
                badges={improvementBadges}
                title="Progress badges"
                description="See improvements and long-term trends based on this assessment and past history."
              />

              {/* Patient Key Insights */}
              <div className="bg-secondary/50 rounded-xl p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" /> What this means for you
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
              className="space-y-8"
            >
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">Clinician decision support</p>
                    <h2 className="mt-1 text-2xl font-bold text-foreground">Detailed risk interpretation</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                      This view keeps the quantitative score, model confidence, contributing factors, and follow-up actions together for clinical review.
                    </p>
                  </div>
                  <div className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-bold ${getRiskColor(assessment.riskCategory)}`}>
                    {assessment.riskCategory} risk
                  </div>
                </div>
              </div>

              {/* Clinician Top Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Predicted Risk Score</p>
                  <p className="text-3xl font-bold font-display flex items-baseline gap-1">
                    {riskScore}<span className="text-xl text-muted-foreground">%</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Model probability
                    {assessment.confidenceInterval && (
                      <span className="block text-[10px] mt-0.5 opacity-80">
                        (95% CI: {assessment.confidenceInterval})
                      </span>
                    )}
                  </p>
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Risk Category</p>
                  <div className={`inline-flex px-3 py-1 rounded-full text-sm font-bold mt-1 ${getRiskColor(assessment.riskCategory)}`}>
                    {assessment.riskCategory}
                  </div>
                  {assessment.modelConfidence && (
                    <p className="text-[10px] text-muted-foreground mt-2 italic">
                      Model confidence: {Number(assessment.modelConfidence).toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="bg-card border border-border p-5 rounded-xl shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Patient Vitals summary</p>
                  <div className="flex flex-col sm:flex-row gap-4 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">BMI</p>
                      <p className="font-semibold">{assessment.bmi}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">HbA1c</p>
                      <p className="font-semibold">{assessment.hba1cLevel}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Glucose</p>
                      <p className="font-semibold">{assessment.bloodGlucoseLevel}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 font-bold">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    Risk-driving factors
                  </h3>
                  <div className="space-y-3">
                    {positiveFactors.length > 0 ? positiveFactors.map((factor: any) => (
                      <div key={factor.name} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                        <p className="font-semibold">{factor.name}</p>
                        <p className="mt-1 text-amber-900/80">{factor.description}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No risk-driving factors were highlighted by the model.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 font-bold">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Protective or lower-risk signals
                  </h3>
                  <div className="space-y-3">
                    {protectiveFactors.length > 0 ? protectiveFactors.map((factor: any) => (
                      <div key={factor.name} className="rounded-lg bg-green-50 p-3 text-sm text-green-950">
                        <p className="font-semibold">{factor.name}</p>
                        <p className="mt-1 text-green-900/80">{factor.description}</p>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">No lower-risk signals were highlighted by the model.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Clinician Chart */}
              <div className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm overflow-hidden">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" /> Factor Coefficient Impact
                </h3>
                <div className="h-56 sm:h-64 w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                                <p className="text-muted-foreground mt-2">{data.plainReason}</p>
                                <p className={`mt-2 font-semibold ${data.impact === 'positive' ? 'text-red-500' : 'text-green-500'}`}>
                                  Impact: {data.impact === 'positive' ? 'Increases Risk' : 'Decreases Risk'} ({data.strength}% relative strength)
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {chartData.map((entry: any, index: number) => (
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

              <div className="rounded-xl border border-border bg-muted/30 p-5">
                <h3 className="mb-4 font-bold">Suggested clinical follow-up</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  {clinicianActions.map((action) => (
                    <div key={action} className="rounded-lg border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">
                      {action}
                    </div>
                  ))}
                </div>
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
  if (factors.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" /> Explainability breakdown
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Relative contribution is scaled from the model's returned factor ranking for this assessment.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
            <TrendingUp className="w-3.5 h-3.5" />
            {increasedRiskFactors.length} raised
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-green-700">
            <TrendingDown className="w-3.5 h-3.5" />
            {reducedRiskFactors.length} reduced
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
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                    increasesRisk
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-green-50 text-green-700 border border-green-200"
                  }`}
                >
                  {increasesRisk ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  {increasesRisk ? "Increases risk" : "Reduces risk"}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1.5">
                  <span>Relative contribution</span>
                  <span>{factor.strength}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${increasesRisk ? "bg-red-500" : "bg-green-500"}`}
                    style={{ width: `${factor.strength}%` }}
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
