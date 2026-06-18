import React from "react";
import { BarChart3, Loader2, TrendingUp } from "lucide-react";
import { type AssessmentResponse } from "@shared/routes";
import { useTranslation } from "react-i18next";
import { useWhatIfSimulation } from "@/hooks/useWhatIfSimulation";
import { SimulatorInputs } from "./assessment/SimulatorInputs";
import { SimulatorResults } from "./assessment/SimulatorResults";

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
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              showComparison
                ? "bg-primary text-white border-primary"
                : "bg-card text-foreground border-border hover:bg-secondary/50"
            }`}
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
          <SimulatorInputs values={values} handleFieldChange={handleFieldChange} />
        </div>
        <SimulatorResults assessment={assessment} simulationResult={simulationResult} batchResult={batchResult} />
      </div>
    </section>
  );
}
