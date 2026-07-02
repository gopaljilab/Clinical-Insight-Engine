import React from 'react';
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, TrendingDown, CheckCircle2 } from "lucide-react";
import { useWhatIfAuto } from "@/hooks/use-assessments";
import { type AssessmentResponse } from "@shared/routes";

export function PathToImprovement({ assessment }: { assessment: AssessmentResponse }) {
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

