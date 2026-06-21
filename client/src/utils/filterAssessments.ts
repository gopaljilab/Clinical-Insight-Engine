import type { Assessment } from "@shared/schema";

export type RiskCategoryFilterValue = "All" | "Low" | "Moderate" | "High";
export type GenderFilterValue = "All" | "Male" | "Female" | "Other";

export interface AgeRangeFilter {
  min?: number;
  max?: number;
}

export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

export interface AssessmentFilterState {
  searchTerm: string;
  riskCategory: RiskCategoryFilterValue;
  gender: GenderFilterValue;
  ageRange: AgeRangeFilter;
  dateRange: DateRangeFilter;
}

const normalizeText = (value: unknown) => String(value ?? "").toLowerCase().trim();

const isValidDateString = (value?: string) => {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

/**
 * Filter Assessments.
 * @param assessments - The assessments parameter.
 * @param filters - The filters parameter.
 * @returns The result of the operation.
 */
export function filterAssessments(
  assessments: Assessment[],
  filters: AssessmentFilterState,
): Assessment[] {
  const normalizedSearch = filters.searchTerm.toLowerCase().trim();
  const hasText = normalizedSearch.length > 0;
  const hasRisk = filters.riskCategory !== "All";
  const hasGender = filters.gender !== "All";
  const hasMinAge = typeof filters.ageRange.min === "number";
  const hasMaxAge = typeof filters.ageRange.max === "number";
  const hasStartDate = isValidDateString(filters.dateRange.startDate);
  const hasEndDate = isValidDateString(filters.dateRange.endDate);

  if (
    !hasText &&
    !hasRisk &&
    !hasGender &&
    !hasMinAge &&
    !hasMaxAge &&
    !hasStartDate &&
    !hasEndDate
  ) {
    return assessments;
  }

  const startTimestamp = hasStartDate
    ? new Date(filters.dateRange.startDate!).setHours(0, 0, 0, 0)
    : undefined;
  const endTimestamp = hasEndDate
    ? new Date(filters.dateRange.endDate!).setHours(23, 59, 59, 999)
    : undefined;

  return assessments.filter((assessment) => {
    const assessmentGender = normalizeText(assessment.gender);
    const riskCategory = normalizeText(assessment.riskCategory);
    const age = Number(assessment.age);

    if (hasRisk && riskCategory !== filters.riskCategory.toLowerCase()) {
      return false;
    }

    if (hasGender) {
      if (filters.gender === "Other") {
        if (assessmentGender === "male" || assessmentGender === "female" || assessmentGender === "") {
          return false;
        }
      } else if (assessmentGender !== filters.gender.toLowerCase()) {
        return false;
      }
    }

    if (hasMinAge && (Number.isNaN(age) || age < filters.ageRange.min!)) {
      return false;
    }

    if (hasMaxAge && (Number.isNaN(age) || age > filters.ageRange.max!)) {
      return false;
    }

    if (hasStartDate || hasEndDate) {
      if (!assessment.createdAt) return false;
      const itemTimestamp = new Date(assessment.createdAt).getTime();
      if (hasStartDate && itemTimestamp < startTimestamp!) return false;
      if (hasEndDate && itemTimestamp > endTimestamp!) return false;
    }

    if (!hasText) {
      return true;
    }

    const searchable = [
      assessment.patientName,
      assessment.gender,
      assessment.riskCategory,
      assessment.smokingHistory,
      assessment.age,
      assessment.bmi,
      assessment.hba1cLevel,
      assessment.bloodGlucoseLevel,
      assessment.riskScore,
      assessment.hypertension ? "yes" : "no",
      assessment.heartDisease ? "yes" : "no",
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());

    return searchable.some((field) => field.includes(normalizedSearch));
  });
}
