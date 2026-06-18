import { useState, useRef, useEffect } from "react";
import { type AssessmentResponse, type AssessmentWhatIfResponse, type AssessmentWhatIfBatchResponse } from "@shared/routes";
import { useWhatIfAssessment, useWhatIfBatch } from "@/hooks/use-assessments";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export function useWhatIfSimulation(
  assessment: AssessmentResponse,
  onComparisonFactors?: (factors: any) => void
) {
  const { t } = useTranslation();
  const { toast } = useToast();

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
      // silent
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
      const response = await whatIfMutation.mutateAsync(buildInput(values));
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

  return {
    values,
    simulationResult,
    batchResult,
    showComparison,
    whatIfMutation,
    handleFieldChange,
    handleRunSimulation,
    toggleComparison,
  };
}
