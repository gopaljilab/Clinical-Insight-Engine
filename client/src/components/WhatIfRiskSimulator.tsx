import React from "react";
import { BarChart3, Loader2, TrendingUp } from "lucide-react";
import { type AssessmentResponse } from "@shared/routes";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getRiskBadgeClasses = (category: string) => {
  switch (category.toUpperCase()) {
    case "LOW":
      return "text-green-700 bg-green-50 border-green-200";
    case "MODERATE":
      return "text-amber-800 bg-amber-50 border-amber-200";
    case "HIGH":
      return "text-red-700 bg-red-50 border-red-200";
    default:
      return "text-slate-700 bg-slate-50 border-slate-200";
  }
};

const getDeltaStyles = (delta: number) => {
  if (delta < 0) {
    return "bg-green-50 text-green-700 border-green-200";
  }
  if (delta > 0) {
    return "bg-red-50 text-red-700 border-red-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
};

interface WhatIfRiskSimulatorProps {
  assessment: AssessmentResponse;
  onComparisonFactors?: (factors: { name: string; impact: string; description: string }[] | null) => void;
}

export function WhatIfRiskSimulator({ assessment, onComparisonFactors }: WhatIfRiskSimulatorProps) {
  const { t } = useTranslation();
  const {
    values,
    simulationResult,
    batchResult,
    showComparison,
    whatIfMutation,
    handleFieldChange,
    handleRunSimulation,
    toggleComparison,
  } = useWhatIfSimulation(assessment, onComparisonFactors);

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
            {t("simulator.title")}
          </p>
          <h3 className="mt-2 text-xl font-bold text-foreground">{t("simulator.heading")}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("simulator.description")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleComparison}
            disabled={!simulationResult}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40",
              showComparison
                ? "bg-primary text-white border-primary"
                : "bg-card text-foreground border-border hover:bg-secondary/50"
            )}
          >
            <BarChart3 className="h-4 w-4" />
            {showComparison ? t("simulator.showingWhatIf") : t("simulator.compareCharts")}
          </button>
          <button
            type="button"
            disabled={whatIfMutation.isPending}
            onClick={handleRunSimulation}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {whatIfMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            {t("simulator.runSimulation")}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="rounded-3xl border border-border bg-secondary/75 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">{t("simulator.bmi")}</span>
              <input
                type="number"
                value={values.bmi}
                min={10}
                max={60}
                step={0.1}
                onChange={(event) => handleFieldChange("bmi", event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">{t("simulator.hba1c")}</span>
              <input
                type="number"
                value={values.hba1cLevel}
                min={3}
                max={15}
                step={0.1}
                onChange={(event) => handleFieldChange("hba1cLevel", event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">{t("simulator.bloodGlucose")}</span>
              <input
                type="number"
                value={values.bloodGlucoseLevel}
                min={50}
                max={400}
                step={1}
                onChange={(event) => handleFieldChange("bloodGlucoseLevel", event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">{t("simulator.smokingStatus")}</span>
              <select
                value={values.smokingHistory}
                onChange={(event) => handleFieldChange("smokingHistory", event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              >
                {smokingStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-border bg-background p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">{t("simulator.currentRisk")}</p>
                <p className="mt-2 text-3xl font-bold text-foreground">{formatPercent(currentRisk)}</p>
              </div>
              <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", getRiskBadgeClasses(assessment.riskCategory))}>
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
              <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", simulationResult ? getRiskBadgeClasses(simulationResult.riskCategory) : "text-slate-500 bg-slate-100 border-slate-200")}>
                {simulationResult?.riskCategory ?? t("simulator.pending")}
              </span>
            </div>
          </div>

          <div className={cn("rounded-3xl border p-5", getDeltaStyles(riskDifference))}>
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
        <SimulatorResults assessment={assessment} simulationResult={simulationResult} batchResult={batchResult} />
      </div>

      {batchResult?.ranked && batchResult.ranked.length > 0 ? (
        <div className="mt-6 rounded-3xl border border-border bg-secondary/80 p-5">
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
                  <div className={cn("flex items-center gap-1 font-bold", isReduction ? "text-green-600" : "text-red-500")}>
                    {isReduction ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                    {Math.abs(item.riskReduction).toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
