import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BarChart3, CheckCircle2, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { type AssessmentResponse, type AssessmentWhatIfResponse, type AssessmentWhatIfBatchResponse } from "@shared/routes";
import { useWhatIfAssessment, useWhatIfBatch } from "@/hooks/use-assessments";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

  const smokingStatusOptions = [
    { label: t("simulator.neverSmoked"), value: "never" },
    { label: t("simulator.formerSmoker"), value: "former" },
    { label: t("simulator.currentSmoker"), value: "current" },
    { label: t("simulator.noInfo"), value: "No Info" },
  ];
  const whatIfMutation = useWhatIfAssessment();
  const whatIfBatchMutation = useWhatIfBatch();

  const [values, setValues] = useState({
    bmi: assessment.bmi ?? 0,
    hba1cLevel: assessment.hba1cLevel ?? 0,
    bloodGlucoseLevel: assessment.bloodGlucoseLevel ?? 0,
    smokingHistory: assessment.smokingHistory ?? "No Info",
  });

  const [simulationResult, setSimulationResult] = useState<AssessmentWhatIfResponse | null>(null);
  const [batchResult, setBatchResult] = useState<AssessmentWhatIfBatchResponse | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const currentRisk = Number(assessment.riskScore ?? 0);
  const simulatedRisk = simulationResult?.simulatedRisk ?? 0;
  const riskDifference = simulationResult ? Number((simulatedRisk - currentRisk).toFixed(1)) : 0;

  const differenceLabel = useMemo(() => {
    if (!simulationResult) {
      return t("simulator.adjustValues");
    }
    if (riskDifference < 0) {
      return t("simulator.riskReduction", { percent: Math.abs(riskDifference).toFixed(1) });
    }
    if (riskDifference > 0) {
      return t("simulator.riskIncrease", { percent: riskDifference.toFixed(1) });
    }
    return t("simulator.riskUnchanged");
  }, [riskDifference, simulationResult, t]);

  const buildInput = (overrides: Partial<typeof values>) => ({
    patientName: assessment.patientName,
    gender: assessment.gender as "Male" | "Female",
    age: assessment.age,
    hypertension: assessment.hypertension,
    heartDisease: assessment.heartDisease,
    smokingHistory: (overrides.smokingHistory ?? values.smokingHistory) as "current" | "never" | "No Info" | "former",
    bmi: Number(overrides.bmi ?? values.bmi),
    hba1cLevel: Number(overrides.hba1cLevel ?? values.hba1cLevel),
    bloodGlucoseLevel: Number(overrides.bloodGlucoseLevel ?? values.bloodGlucoseLevel),
  });

  const runSimulation = async (currentValues: typeof values) => {
    try {
      const response = await whatIfMutation.mutateAsync(buildInput(currentValues));
      setSimulationResult(response);
      if (onComparisonFactors) {
        onComparisonFactors(response.factors ?? null);
      }
    } catch {
      // silent — individual field changes may fail gracefully
    }
  };

  const handleFieldChange = (field: keyof typeof values, value: string) => {
    const newValues = {
      ...values,
      [field]: field === "smokingHistory" ? value : Number(value),
    };
    setValues(newValues);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSimulation(newValues), 600);
  };

  const handleRunSimulation = async () => {
    try {
      const response = await whatIfMutation.mutateAsync({
        patientName: assessment.patientName,
        gender: assessment.gender as "Male" | "Female",
        age: assessment.age,
        hypertension: assessment.hypertension,
        heartDisease: assessment.heartDisease,
        smokingHistory: values.smokingHistory as "current" | "never" | "No Info" | "former",
        bmi: values.bmi,
        hba1cLevel: values.hba1cLevel,
        bloodGlucoseLevel: values.bloodGlucoseLevel,
      });
      setSimulationResult(response);
      if (onComparisonFactors) {
        onComparisonFactors(response.factors ?? null);
      }
      toast({
        title: t("simulator.simulationComplete"),
        description: t("simulator.simulationReady"),
      });
    } catch (error: unknown) {
      toast({
        title: "Simulation failed",
        description: (error as Error).message ?? "Unable to calculate the simulated risk.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const perturbations: Record<string, string | number | boolean>[] = [
      { bmi: 25 },
      { hba1cLevel: 5.7 },
      { hba1cLevel: 6.5 },
      { bloodGlucoseLevel: 100 },
      { bloodGlucoseLevel: 140 },
      { smokingHistory: "never" },
      { bmi: 22, hba1cLevel: 5.5 },
    ];

    whatIfBatchMutation.mutate(
      { original: buildInput(values), perturbations },
      {
        onSuccess: (data) => setBatchResult(data),
        onError: () => {},
      }
    );
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const toggleComparison = () => {
    const next = !showComparison;
    setShowComparison(next);
    if (onComparisonFactors) {
      onComparisonFactors(next ? (simulationResult?.factors ?? null) : null);
    }
  };

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