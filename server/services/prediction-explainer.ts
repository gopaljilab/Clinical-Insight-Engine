import { type Assessment, type AssessmentFactor } from "@shared/schema";
import type { PredictionExplanation } from "@shared/routes";

type ExplainerInput = Partial<Assessment> & {
  riskCategory?: string;
  factors?: AssessmentFactor[];
};

function normalizeFactors(factors?: AssessmentFactor[]): AssessmentFactor[] {
  if (!Array.isArray(factors)) return [];
  return factors;
}

function getFactorWeight(factor: AssessmentFactor, maxAbsLogOdds: number): number {
  if (factor.logOdds == null || maxAbsLogOdds <= 0) return 0;
  return Math.round((Math.abs(factor.logOdds) / maxAbsLogOdds) * 100);
}

function getFactorWhy(factor: AssessmentFactor, input: ExplainerInput): string {
  const name = factor.name.toLowerCase();
  const reason = factor.description;

  if (name.includes("hba1c")) {
    const value = input.hba1cLevel;
    return value != null
      ? `HbA1c is ${value.toFixed(1)}%, so ${reason.toLowerCase()}`
      : reason;
  }

  if (name.includes("bmi")) {
    const value = input.bmi;
    return value != null
      ? `BMI is ${value.toFixed(1)}, indicating ${reason.toLowerCase()}`
      : reason;
  }

  if (name.includes("glucose")) {
    const value = input.bloodGlucoseLevel;
    return value != null
      ? `Blood glucose is ${value.toFixed(0)} mg/dL, which means ${reason.toLowerCase()}`
      : reason;
  }

  if (name.includes("hypertension") || name.includes("heart disease") || name.includes("smoking")) {
    const inputValue =
      name.includes("hypertension") && input.hypertension
        ? "yes"
        : name.includes("heart disease") && input.heartDisease
        ? "yes"
        : name.includes("smoking") && input.smokingHistory
        ? String(input.smokingHistory)
        : undefined;
    return inputValue
      ? `${reason} Current input: ${inputValue}.`
      : reason;
  }

  return reason;
}

function formatFactorLabel(name: string): string {
  if (name.toLowerCase().includes("hba1c")) return "HbA1c";
  if (name.toLowerCase().includes("bmi")) return "BMI";
  if (name.toLowerCase().includes("glucose")) return "Blood glucose";
  if (name.toLowerCase().includes("hypertension")) return "Hypertension";
  if (name.toLowerCase().includes("heart disease")) return "Heart disease";
  if (name.toLowerCase().includes("smoking")) return "Smoking history";
  if (name.toLowerCase().includes("age")) return "Age";
  return name;
}

function summarizeContributorNames(contributors: Array<PredictionExplanation["topContributors"][number]>): string {
  if (contributors.length === 0) return "no strong contributors";
  if (contributors.length === 1) return contributors[0].name;

  const names = contributors.map((item) => item.name);
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Generate Prediction Explanation.
 * @param input - The input parameter.
 * @returns The result of the operation.
 */
export function generatePredictionExplanation(input: ExplainerInput): PredictionExplanation {
  const factors = normalizeFactors(input.factors);
  const maxAbsLogOdds = Math.max(0, ...factors.map((factor) => Math.abs(factor.logOdds ?? 0)));
  const weightedFactors = factors.map((factor) => ({
    ...factor,
    strength: getFactorWeight(factor, maxAbsLogOdds),
    why: getFactorWhy(factor, input),
  }));

  const sortedByStrength = [...weightedFactors].sort((a, b) => b.strength - a.strength);
  const positiveContributors = sortedByStrength.filter((factor) => factor.impact === "positive");
  const negativeContributors = sortedByStrength.filter((factor) => factor.impact === "negative");

  const topContributors = sortedByStrength.slice(0, 4);
  const strongestPositive = positiveContributors.slice(0, 3);
  const strongestNegative = negativeContributors.slice(0, 3);

  const riskCategory = (input.riskCategory || "LOW").toUpperCase();
  const riskLabel = riskCategory === "HIGH" ? "high" : riskCategory === "MODERATE" ? "moderate" : "low";

  const positiveNames = summarizeContributorNames(strongestPositive);
  const negativeNames = summarizeContributorNames(strongestNegative);

  const summary = `The model assigns a ${riskLabel} preventive diabetes risk category. The strongest drivers were ${positiveNames}.${negativeNames ? ` Protective or lower-risk contributors included ${negativeNames}.` : ""}`;

  const patientSummary = `Your assessment shows ${riskLabel} diabetes risk. It is mostly influenced by ${positiveNames.toLowerCase()}. ${negativeNames ? `Supportive factors included ${negativeNames.toLowerCase()}, which slightly reduce the overall risk.` : ""}`;

  const clinicianSummary = `This prediction uses clinical inputs and factor contributions to produce a ${riskLabel} risk classification. Key positive contributors are ${positiveNames.toLowerCase()}.${negativeNames ? ` Key protective signals are ${negativeNames.toLowerCase()}.` : ""} Review the contributor details and relevant vital signs to guide follow-up.`;

  return {
    summary,
    patientSummary,
    clinicianSummary,
    topContributors,
    strongestPositive,
    strongestNegative,
  };
}

export default { generatePredictionExplanation };
