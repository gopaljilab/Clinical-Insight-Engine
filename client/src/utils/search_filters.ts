import type { Assessment } from "@shared/schema";

/**
 * Filters assessments by a search term across all clinically relevant fields.
 * Searches: gender, riskCategory, smokingHistory, age, bmi, hba1cLevel,
 * bloodGlucoseLevel, riskScore, hypertension (yes/no), heartDisease (yes/no).
 */
export function advancedFilter(assessments: Assessment[], query: string): Assessment[] {
  const term = query.toLowerCase().trim();
  if (!term) return assessments;
  return assessments.filter(a =>
    a.gender.toLowerCase().includes(term) ||
    a.riskCategory.toLowerCase().includes(term) ||
    a.smokingHistory.toLowerCase().includes(term) ||
    String(a.age).includes(term) ||
    String(a.bmi).includes(term) ||
    String(a.hba1cLevel).includes(term) ||
    String(a.bloodGlucoseLevel).includes(term) ||
    String(a.riskScore).includes(term) ||
    (term === "yes" && (a.hypertension || a.heartDisease)) ||
    (term === "no" && (!a.hypertension || !a.heartDisease))
  );
}
