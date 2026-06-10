import { type AssessmentResponse } from "@shared/routes";

export type HealthBadgeId =
  | "improved-bmi"
  | "reduced-hba1c"
  | "reduced-glucose"
  | "lower-risk"
  | "healthy-streak";

export interface HealthBadge {
  id: HealthBadgeId;
  title: string;
  description: string;
  tooltip: string;
}

function normalizePatientName(name: unknown) {
  if (typeof name !== "string" || !name.trim()) {
    return "Unknown Patient";
  }
  return name.trim();
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getRiskCategoryRank(category: unknown) {
  const normalized = typeof category === "string" ? category.trim().toUpperCase() : "";
  switch (normalized) {
    case "LOW":
      return 1;
    case "MODERATE":
      return 2;
    case "HIGH":
      return 3;
    default:
      return 4;
  }
}

function getPreviousAssessment(
  current: AssessmentResponse,
  history: AssessmentResponse[]
) {
  const patientName = normalizePatientName(current.patientName);

  return history
    .filter((assessment) => {
      const candidateName = normalizePatientName(assessment.patientName);
      if (candidateName !== patientName) return false;
      if (assessment.id && current.id && assessment.id === current.id) return false;
      if (!assessment.createdAt || !current.createdAt) return false;
      return new Date(assessment.createdAt).getTime() < new Date(current.createdAt).getTime();
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    )[0];
}

function hasAnyImprovement(
  newest: AssessmentResponse,
  previous: AssessmentResponse
) {
  const currentBmi = parseNumber(newest.bmi);
  const previousBmi = parseNumber(previous.bmi);
  const hasBmi = currentBmi !== null && previousBmi !== null && currentBmi < previousBmi;

  const currentHba1c = parseNumber(newest.hba1cLevel);
  const previousHba1c = parseNumber(previous.hba1cLevel);
  const hasHba1c =
    currentHba1c !== null &&
    previousHba1c !== null &&
    currentHba1c < previousHba1c;

  const currentGlucose = parseNumber(newest.bloodGlucoseLevel);
  const previousGlucose = parseNumber(previous.bloodGlucoseLevel);
  const hasGlucose =
    currentGlucose !== null &&
    previousGlucose !== null &&
    currentGlucose < previousGlucose;

  const currentRisk = parseNumber(newest.riskScore);
  const previousRisk = parseNumber(previous.riskScore);
  const hasRisk =
    (currentRisk !== null && previousRisk !== null && currentRisk < previousRisk) ||
    getRiskCategoryRank(newest.riskCategory) <
      getRiskCategoryRank(previous.riskCategory);

  return hasBmi || hasHba1c || hasGlucose || hasRisk;
}

export function calculateHealthBadges(
  current: AssessmentResponse,
  history: AssessmentResponse[]
) {
  const previous = getPreviousAssessment(current, history);
  if (!previous) return [];

  const badges: HealthBadge[] = [];
  const currentBmi = parseNumber(current.bmi);
  const previousBmi = parseNumber(previous.bmi);
  const currentHba1c = parseNumber(current.hba1cLevel);
  const previousHba1c = parseNumber(previous.hba1cLevel);
  const currentGlucose = parseNumber(current.bloodGlucoseLevel);
  const previousGlucose = parseNumber(previous.bloodGlucoseLevel);
  const currentRisk = parseNumber(current.riskScore);
  const previousRisk = parseNumber(previous.riskScore);

  if (currentBmi !== null && previousBmi !== null && currentBmi < previousBmi) {
    badges.push({
      id: "improved-bmi",
      title: "BMI improvement",
      description: "Current assessment shows a lower BMI than the previous visit.",
      tooltip: "Sustained BMI reduction helps lower long-term metabolic and cardiovascular risk.",
    });
  }

  if (currentHba1c !== null && previousHba1c !== null && currentHba1c < previousHba1c) {
    badges.push({
      id: "reduced-hba1c",
      title: "Lower HbA1c",
      description: "Your latest HbA1c result is lower than the prior assessment.",
      tooltip: "Improvements in HbA1c often reflect better blood sugar control over time.",
    });
  }

  if (
    currentGlucose !== null &&
    previousGlucose !== null &&
    currentGlucose < previousGlucose
  ) {
    badges.push({
      id: "reduced-glucose",
      title: "Lower glucose",
      description: "Blood glucose levels have improved compared to the previous visit.",
      tooltip: "Lower glucose values indicate a healthier short-term metabolic response.",
    });
  }

  if (
    (currentRisk !== null && previousRisk !== null && currentRisk < previousRisk) ||
    getRiskCategoryRank(current.riskCategory) <
      getRiskCategoryRank(previous.riskCategory)
  ) {
    badges.push({
      id: "lower-risk",
      title: "Lower risk profile",
      description: "Assessment risk is lower than the previous evaluation.",
      tooltip: "A reduced risk score or category signals progress toward preventive targets.",
    });
  }

  const samePatientHistory = history
    .filter((assessment) =>
      normalizePatientName(assessment.patientName) ===
      normalizePatientName(current.patientName)
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );

  if (samePatientHistory.length >= 3) {
    const [latest, second, third] = samePatientHistory;
    if (
      latest &&
      second &&
      third &&
      hasAnyImprovement(latest, second) &&
      hasAnyImprovement(second, third)
    ) {
      badges.push({
        id: "healthy-streak",
        title: "Healthy streak",
        description: "Three consecutive assessments show positive trajectory changes.",
        tooltip: "Sustained improvement across several visits indicates a strong long-term trend.",
      });
    }
  }

  return badges;
}
