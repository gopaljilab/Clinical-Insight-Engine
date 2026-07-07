import React from 'react';
import { Info, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { FactorBreakdown } from "../AssessmentResult";

export function ExplainabilityPanel({
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

