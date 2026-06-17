import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, ChevronDown, ChevronUp, FlaskConical, Activity, Heart,
  AlertTriangle, Clock, Stethoscope, TrendingUp, FileText,
  Lightbulb, ExternalLink, RotateCcw
} from "lucide-react";
import type { AssessmentResponse } from "@shared/routes";
import { useTranslation } from "react-i18next";

interface CopilotSuggestion {
  id: string;
  category: "diagnostic_test" | "monitoring" | "lifestyle" | "referral" | "follow_up";
  title: string;
  description: string;
  rationale: string;
  urgency: "high" | "medium" | "low";
  evidence: string;
}

function generateCopilotSuggestions(assessment: AssessmentResponse): CopilotSuggestion[] {
  const suggestions: CopilotSuggestion[] = [];
  const rc = (assessment.riskCategory || "").toUpperCase();
  const bmi = Number(assessment.bmi) || 0;
  const hba1c = Number(assessment.hba1cLevel) || 0;
  const glucose = Number(assessment.bloodGlucoseLevel) || 0;
  const smoking = (assessment.smokingHistory || "").toLowerCase();
  const hasHypertension = assessment.hypertension;
  const hasHeartDisease = assessment.heartDisease;
  const isHighRisk = rc === "HIGH";
  const isModerate = rc === "MODERATE";

  if (isHighRisk || hba1c >= 6.5 || glucose >= 126) {
    suggestions.push({
      id: "ogtt",
      category: "diagnostic_test",
      title: "Oral Glucose Tolerance Test (OGTT)",
      description: "Confirm diabetes diagnosis with a 2-hour 75g OGTT if not already performed.",
      rationale: `HbA1c of ${hba1c}% and glucose of ${glucose} mg/dL suggest impaired glucose regulation requiring confirmatory testing.`,
      urgency: "high",
      evidence: "ADA Standards of Care 2025 recommend OGTT for diabetes confirmation when HbA1c is discordant with fasting glucose."
    });
  }

  if (isHighRisk || hasHypertension || hasHeartDisease) {
    suggestions.push({
      id: "lipid_panel",
      category: "diagnostic_test",
      title: "Comprehensive Lipid Panel",
      description: "Order fasting lipid panel (TC, LDL-C, HDL-C, TGs) to assess cardiovascular risk profile.",
      rationale: `${isHighRisk ? "High-risk classification" : "Cardiovascular comorbidity"} warrants full lipid assessment for ASCVD risk calculation.`,
      urgency: "high",
      evidence: "ACC/AHA guidelines recommend lipid panel in all patients with elevated cardiovascular risk."
    });
  }

  if (bmi >= 30 || (bmi >= 25 && isHighRisk)) {
    suggestions.push({
      id: "liver_function",
      category: "diagnostic_test",
      title: "Liver Function Tests (LFTs)",
      description: "Screen for non-alcoholic fatty liver disease (NAFLD) with ALT, AST, GGT.",
      rationale: `BMI of ${bmi} places the patient at risk for NAFLD, which is commonly associated with metabolic syndrome.`,
      urgency: "medium",
      evidence: "AASLD guidelines recommend NAFLD screening in patients with obesity and metabolic risk factors."
    });
  }

  if (isHighRisk) {
    suggestions.push({
      id: "monitor_hba1c_3mo",
      category: "monitoring",
      title: "HbA1c Monitoring Every 3 Months",
      description: "Repeat HbA1c every 3 months until stable below 7.0%, then every 6 months.",
      rationale: "High-risk patients require frequent glycemic monitoring to assess treatment response and prevent complications.",
      urgency: "high",
      evidence: "ADA recommends HbA1c testing at least twice yearly in stable patients, quarterly in uncontrolled diabetes."
    });
  }

  if (hasHypertension) {
    suggestions.push({
      id: "bp_monitoring",
      category: "monitoring",
      title: "Home Blood Pressure Monitoring",
      description: "Daily home BP monitoring with a validated device; log readings for review at next visit.",
      rationale: "Hypertension requires active monitoring to guide medication titration and assess control.",
      urgency: "medium",
      evidence: "ACC/AHA guideline recommends home BP monitoring for all patients with diagnosed hypertension."
    });
  }

  if (bmi >= 25) {
    suggestions.push({
      id: "weight_program",
      category: "lifestyle",
      title: "Structured Weight Management Program",
      description: `Target ${bmi >= 30 ? "5-10% body weight reduction" : "weight maintenance with improved metabolic fitness"} through a comprehensive program of diet and physical activity.`,
      rationale: `BMI of ${bmi} falls in the ${bmi >= 30 ? "obese" : "overweight"} range, a primary modifiable risk factor for diabetes and cardiovascular disease.`,
      urgency: bmi >= 30 ? "high" : "medium",
      evidence: "Look AHEAD trial and multiple meta-analyses show that 5-7% weight loss reduces diabetes incidence by 58%."
    });
  }

  if (smoking === "current") {
    suggestions.push({
      id: "smoking_cessation",
      category: "lifestyle",
      title: "Intensive Smoking Cessation Program",
      description: "Combine pharmacotherapy (nicotine replacement, varenicline) with behavioral counseling.",
      rationale: "Current smoking significantly compounds cardiovascular and diabetic microvascular risk.",
      urgency: "high",
      evidence: "USPSTF recommends offering pharmacotherapy and behavioral interventions for all tobacco users."
    });
  }

  if (bmi >= 25 || isModerate || isHighRisk) {
    suggestions.push({
      id: "diet_referral",
      category: "lifestyle",
      title: "Medical Nutrition Therapy (MNT)",
      description: "Refer to registered dietitian for individualized medical nutrition therapy focused on glycemic control and cardiometabolic health.",
      rationale: "Dietary modification is a cornerstone of diabetes prevention and management.",
      urgency: isHighRisk ? "high" : "medium",
      evidence: "ADA recommends MNT provided by a registered dietitian as an essential component of diabetes management."
    });
  }

  if (isHighRisk || (isModerate && (hasHeartDisease || hasHypertension))) {
    suggestions.push({
      id: "cardiology_referral",
      category: "referral",
      title: "Cardiology Consultation",
      description: "Refer to cardiology for comprehensive cardiovascular risk assessment and management.",
      rationale: `${isHighRisk ? "High diabetes risk" : "Moderate risk with cardiac comorbidity"} necessitates specialist evaluation.`,
      urgency: isHighRisk ? "high" : "medium",
      evidence: "ACC/AHA guidelines recommend cardiology referral for patients with elevated cardiovascular risk and multiple risk factors."
    });
  }

  if (hasHeartDisease && isModerate) {
    suggestions.push({
      id: "endocrinology_referral",
      category: "referral",
      title: "Endocrinology Consultation",
      description: "Refer to endocrinology for specialized metabolic risk management.",
      rationale: "Coexisting heart disease and metabolic risk warrant specialized endocrine evaluation.",
      urgency: "medium",
      evidence: "AACE guidelines recommend endocrinology referral for complex metabolic cases."
    });
  }

  if (isModerate || isHighRisk) {
    suggestions.push({
      id: "follow_up_1mo",
      category: "follow_up",
      title: `Follow-Up Visit Within ${isHighRisk ? "2 Weeks" : "1 Month"}`,
      description: `Schedule follow-up within ${isHighRisk ? "2 weeks" : "1 month"} to review lab results, assess treatment response, and adjust care plan.`,
      rationale: "Timely follow-up ensures treatment adherence and allows early intervention for worsening trends.",
      urgency: isHighRisk ? "high" : "medium",
      evidence: "Clinical practice guidelines recommend short-interval follow-up for patients with elevated cardiometabolic risk."
    });
  }

  return suggestions;
}

export function ClinicalCopilot({ assessment }: { assessment: AssessmentResponse }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const suggestions = useMemo(() => generateCopilotSuggestions(assessment), [assessment]);

  const categories = [
    { key: "diagnostic_test", label: t("copilot.catDiagnosticTest"), icon: FlaskConical, color: "text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900" },
    { key: "monitoring", label: t("copilot.catMonitoring"), icon: Activity, color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900" },
    { key: "lifestyle", label: t("copilot.catLifestyle"), icon: Heart, color: "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/30 border-green-200 dark:border-green-900" },
    { key: "referral", label: t("copilot.catReferral"), icon: Stethoscope, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900" },
    { key: "follow_up", label: t("copilot.catFollowUp"), icon: RotateCcw, color: "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900" },
  ];

  const grouped = useMemo(() => {
    const map = new Map<string, CopilotSuggestion[]>();
    for (const s of suggestions) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return map;
  }, [suggestions]);

  const rc = (assessment.riskCategory || "").toUpperCase();
  const severityColor = rc === "HIGH" ? "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:bg-red-950/30 dark:border-red-900" :
    rc === "MODERATE" ? "text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900" :
    "text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:bg-green-950/30 dark:border-green-900";
  const bmi = Number(assessment.bmi) || 0;
  const hba1c = Number(assessment.hba1cLevel) || 0;
  const glucose = Number(assessment.bloodGlucoseLevel) || 0;
  const smoking = (assessment.smokingHistory || "").toLowerCase();
  const hasHypertension = assessment.hypertension;
  const hasHeartDisease = assessment.heartDisease;
  const criticalCount = suggestions.filter(s => s.urgency === "high").length;
  const totalCount = suggestions.length;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground">{t("copilot.title")}</h3>
              {criticalCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-950/40 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
                  <AlertTriangle className="w-3 h-3" />
                  {t("copilot.urgentCount", { count: criticalCount })}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("copilot.recommendationsCount", { count: totalCount })}
            </p>
          </div>
        </div>
        <div className="shrink-0 ml-3">
          {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 md:px-5 pb-5 space-y-4">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${severityColor}`}>
                <TrendingUp className="w-3.5 h-3.5" />
                {rc === "HIGH" ? t("copilot.intensiveManagement") :
                 rc === "MODERATE" ? t("copilot.preventiveMeasures") :
                 t("copilot.maintainHabits")}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                    {t("copilot.patientSummary")}
                </p>
                <div className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-xl p-3 border border-border/50">
                  {t("copilot.summaryLine", {
                    gender: assessment.gender === "Female" ? t("copilot.female") : t("copilot.male"),
                    age: assessment.age,
                    bmi: assessment.bmi,
                    hypertension: hasHypertension ? t("copilot.hypertension") : "",
                    heartDisease: hasHeartDisease ? t("copilot.heartDisease") : "",
                    smoking,
                    hba1c,
                    glucose,
                    rc
                  })}
                </div>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat.key}
                    onClick={() => setActiveCategory(activeCategory === cat.key ? null : cat.key)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                      activeCategory === cat.key
                        ? cat.color + " ring-2 ring-offset-1"
                        : "text-muted-foreground border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <cat.icon className="w-3.5 h-3.5" />
                    {cat.label}
                    {grouped.get(cat.key) && (
                      <span className="opacity-60">({grouped.get(cat.key)!.length})</span>
                    )}
                  </button>
                ))}
              </div>

              {categories.map(cat => {
                const catSuggestions = grouped.get(cat.key) || [];
                if (catSuggestions.length === 0) return null;
                const isActive = activeCategory === null || activeCategory === cat.key;
                return (
                  <div key={cat.key} className={`space-y-2 ${isActive ? "" : "hidden"}`}>
                    <div className={`flex items-center gap-2 border-b border-border pb-1.5`}>
                      <cat.icon className={`w-4 h-4 ${cat.color.split(" ")[0]}`} />
                      <h4 className="text-sm font-bold text-foreground">{cat.label}</h4>
                    </div>
                    <div className="space-y-2">
                      {catSuggestions.map(s => (
                        <div key={s.id} className="rounded-xl border border-border/60 bg-muted/20 p-3.5 hover:bg-muted/40 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm text-foreground">{s.title}</p>
                                  {s.urgency === "high" && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 dark:bg-red-950/40 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400">
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      {t("copilot.high")}
                                    </span>
                                  )}
                                  {s.urgency === "medium" && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                      <Clock className="w-2.5 h-2.5" />
                                      {t("copilot.medium")}
                                    </span>
                                  )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                              <div className="mt-2 flex gap-2">
                                <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                                  <Lightbulb className="w-3 h-3" />
                                  {s.rationale}
                                </span>
                              </div>
                              <div className="mt-1.5 flex items-start gap-1.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg p-2 border border-indigo-100 dark:border-indigo-900/30">
                                <ExternalLink className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-indigo-700 dark:text-indigo-400 leading-relaxed">{s.evidence}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

                {suggestions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="font-semibold">{t("copilot.noRecommendations")}</p>
                    <p className="text-sm mt-1">{t("copilot.noRecommendationsDesc")}</p>
                  </div>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ClinicalCopilot;
