import React, { useMemo } from "react";
import { ArrowDown, ArrowUp, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getRiskBadgeClasses = (category: string) => {
  switch (category.toUpperCase()) {
    case "LOW": return "text-green-700 bg-green-50 border-green-200";
    case "MODERATE": return "text-amber-800 bg-amber-50 border-amber-200";
    case "HIGH": return "text-red-700 bg-red-50 border-red-200";
    default: return "text-slate-700 bg-slate-50 border-slate-200";
  }
};

const getDeltaStyles = (delta: number) => {
  if (delta < 0) return "bg-green-50 text-green-700 border-green-200";
  if (delta > 0) return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
};

export function SimulatorResults({ assessment, simulationResult, batchResult }: any) {
  const { t } = useTranslation();

  const currentRisk = Number(assessment.riskScore ?? 0);
  const simulatedRisk = simulationResult?.simulatedRisk ?? 0;
  const riskDifference = simulationResult ? Number((simulatedRisk - currentRisk).toFixed(1)) : 0;

  const differenceLabel = useMemo(() => {
    if (!simulationResult) return t("simulator.adjustValues");
    if (riskDifference < 0) return t("simulator.riskReduction", { percent: Math.abs(riskDifference).toFixed(1) });
    if (riskDifference > 0) return t("simulator.riskIncrease", { percent: riskDifference.toFixed(1) });
    return t("simulator.riskUnchanged");
  }, [riskDifference, simulationResult, t]);

  return (
    <>
      <div className="grid gap-4">
        <div className="rounded-3xl border border-border bg-background p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{t("simulator.currentRisk")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{formatPercent(currentRisk)}</p>
            </div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getRiskBadgeClasses(assessment.riskCategory)}`}>
              {assessment.riskCategory}
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-background p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{t("simulator.simulatedRisk")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {simulationResult ? formatPercent(simulatedRisk) : "--"}
              </p>
            </div>
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${simulationResult ? getRiskBadgeClasses(simulationResult.riskCategory) : "text-slate-500 bg-slate-100 border-slate-200"}`}>
              {simulationResult?.riskCategory ?? t("simulator.pending")}
            </span>
          </div>
        </div>

        <div className={`rounded-3xl border ${getDeltaStyles(riskDifference)} p-5`}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-current/5 grid place-items-center text-current">
              {riskDifference < 0 ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t("simulator.riskDifference")}</p>
              <p className="mt-2 text-lg font-bold">{simulationResult ? `${riskDifference > 0 ? "+" : ""}${riskDifference.toFixed(1)}%` : "--"}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{differenceLabel}</p>
        </div>
      </div>

      {batchResult?.ranked && batchResult.ranked.length > 0 ? (
        <div className="mt-6 rounded-3xl border border-border bg-secondary/80 p-5 col-span-full">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            {t("simulator.biggestImpact")}
          </div>
          <div className="grid gap-3">
            {batchResult.ranked.slice(0, 5).map((item: any, i: number) => {
              const isReduction = item.riskReduction > 0;
              return (
                <div key={item.delta} className="flex items-center justify-between rounded-2xl border border-border/70 bg-card p-4 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{item.delta}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t("simulator.newRisk", { score: item.riskScore.toFixed(1), category: item.riskCategory })}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 font-bold ${isReduction ? "text-green-600" : "text-red-500"}`}>
                    {isReduction ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                    {Math.abs(item.riskReduction).toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
