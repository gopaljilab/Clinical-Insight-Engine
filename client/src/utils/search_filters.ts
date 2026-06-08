import type { Assessment } from "@shared/schema";

export type MetricKey = "bmi" | "hba1cLevel" | "bloodGlucoseLevel";

export type MetricRangeFilters = Partial<
  Record<MetricKey, { min?: number | null; max?: number | null }>
>;

function isWithinRange(value: number, range?: { min?: number | null; max?: number | null }) {
  if (!range) return true;
  if (typeof range.min === "number" && value < range.min) return false;
  if (typeof range.max === "number" && value > range.max) return false;
  return true;
}

export function hasActiveMetricFilters(filters: MetricRangeFilters): boolean {
  return Object.values(filters).some(
    (range) => typeof range?.min === "number" || typeof range?.max === "number",
  );
}

export function passesMetricFilters(
  assessment: Assessment,
  filters: MetricRangeFilters,
): boolean {
  return (
    isWithinRange(Number(assessment.bmi), filters.bmi) &&
    isWithinRange(Number(assessment.hba1cLevel), filters.hba1cLevel) &&
    isWithinRange(Number(assessment.bloodGlucoseLevel), filters.bloodGlucoseLevel)
  );
}

/**
 * Filters assessments by a search term across all clinically relevant fields.
 * Searches: patientName, gender, riskCategory, smokingHistory, age, bmi, hba1cLevel,
 * bloodGlucoseLevel, riskScore, hypertension (yes/no), heartDisease (yes/no).
 */
export function advancedFilter(
  assessments: Assessment[],
  query: string,
  metricFilters: MetricRangeFilters = {},
): Assessment[] {
  const term = query.toLowerCase().trim();
  const hasMetricFilters = hasActiveMetricFilters(metricFilters);
  if (!term && !hasMetricFilters) return assessments;

  return assessments.filter(a =>
    passesMetricFilters(a, metricFilters) &&
    (
      !term ||
      (a.patientName ?? "").toLowerCase().includes(term) ||
      a.gender.toLowerCase().includes(term) ||
      a.riskCategory.toLowerCase().includes(term) ||
      a.smokingHistory.toLowerCase().includes(term) ||
      String(a.age).includes(term) ||
      String(a.bmi).includes(term) ||
      String(a.hba1cLevel).includes(term) ||
      String(a.bloodGlucoseLevel).includes(term) ||
      String(a.riskScore).includes(term) ||
      (term === "yes" && (a.hypertension || a.heartDisease)) ||
      (term === "no" && (!a.hypertension && !a.heartDisease))
    )
  );
}
