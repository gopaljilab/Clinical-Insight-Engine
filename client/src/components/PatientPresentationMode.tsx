import { useEffect } from "react";
import { type AssessmentResponse } from "@shared/routes";
import { X, UserCircle, Target, CheckCircle2, TrendingDown } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface Props {
  assessment: AssessmentResponse;
  onClose: () => void;
}

export function PatientPresentationMode({ assessment, onClose }: Props) {
  const { t } = useTranslation();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const getRiskColor = (category: string) => {
    switch (category.toUpperCase()) {
      case "LOW":
        return "text-green-600 bg-green-50 border-green-200 ring-green-500/30 shadow-[0_0_25px_rgba(34,197,94,0.3)]";
      case "MODERATE":
        return "text-amber-600 bg-amber-50 border-amber-200 ring-amber-500/30 shadow-[0_0_25px_rgba(245,158,11,0.3)]";
      case "HIGH":
        return "text-red-600 bg-red-50 border-red-200 ring-red-500/30 shadow-[0_0_25px_rgba(239,68,68,0.4)]";
      default:
        return "text-blue-600 bg-blue-50 border-blue-200";
    }
  };

  const smartGoals = [];
  
  if (assessment.hba1cLevel && Number(assessment.hba1cLevel) > 5.7) {
    smartGoals.push({
      title: t("patientPresentation.targetHba1c"),
      description: t("patientPresentation.targetHba1cDesc"),
      icon: <CheckCircle2 className="w-6 h-6 text-green-500" />
    });
  }

  if (assessment.bmi && Number(assessment.bmi) > 25) {
    const targetBmi = (Number(assessment.bmi) * 0.95).toFixed(1);
    smartGoals.push({
      title: t("patientPresentation.targetBmi", { bmi: targetBmi }),
      description: t("patientPresentation.targetBmiDesc"),
      icon: <TrendingDown className="w-6 h-6 text-blue-500" />
    });
  }

  if (smartGoals.length === 0) {
    smartGoals.push({
      title: t("patientPresentation.maintainHealth"),
      description: t("patientPresentation.maintainHealthDesc"),
      icon: <CheckCircle2 className="w-6 h-6 text-green-500" />
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-50/95 backdrop-blur-md overflow-y-auto"
    >
      <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 md:p-12 relative">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 md:top-8 md:right-8 p-3 bg-white border border-slate-200 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 shadow-sm transition-all duration-200 active:scale-[0.92]"
          aria-label={t("patientPresentation.exitAria")}
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center space-y-4 sm:space-y-6 max-w-3xl mx-auto pt-6 sm:pt-10 md:pt-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-primary">
            <UserCircle className="h-5 w-5" />
            {t("patientPresentation.title")}
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight">
            {t("patientPresentation.yourHealth")}
          </h1>

          <div className="py-6 sm:py-8 md:py-12">
            <div
              className={cn(
                "mx-auto flex flex-col items-center justify-center w-40 h-40 sm:w-56 sm:h-56 md:w-72 md:h-72 rounded-full border-[8px] sm:border-[12px] ring-4 ring-offset-4",
                getRiskColor(assessment.riskCategory)
              )}
            >
              <span className="text-xs sm:text-base md:text-lg font-bold uppercase tracking-widest opacity-80 mb-1 sm:mb-2">
                {t("patientPresentation.riskLevel")}
              </span>
              <span className="text-3xl sm:text-5xl md:text-6xl font-display font-black tracking-tight">
                {assessment.riskCategory}
              </span>
            </div>
          </div>

          <p className="text-xl md:text-2xl text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto">
            {t("patientPresentation.basedOnInfo")}
            <strong className="text-slate-900">{assessment.riskCategory.toLowerCase()}</strong>.
          </p>
        </div>

        <div className="mt-8 sm:mt-16 md:mt-24 space-y-6 sm:space-y-8 max-w-4xl mx-auto">
          <h3 className="font-bold text-2xl flex items-center gap-3 border-b pb-4">
            <Target className="w-7 h-7 text-primary" /> {t("patientPresentation.clinicalGoals")}
          </h3>
          <div className="grid gap-6 md:grid-cols-2">
            {smartGoals.map((goal, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * idx }}
                key={idx}
                className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 flex gap-4 hover:shadow-md transition-all duration-300"
              >
                <div className="shrink-0 mt-1">{goal.icon}</div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 mb-2">{goal.title}</h4>
                  <p className="text-base text-slate-600 leading-relaxed">{goal.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-8 sm:mt-16 text-center pb-8 sm:pb-12">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-md transition-all duration-200 active:scale-[0.98]"
          >
            {t("patientPresentation.endPresentation")}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
