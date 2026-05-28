import type { Assessment } from "@shared/schema";

export function advancedFilter(assessments: Assessment[], query: string): Assessment[] {
  const term = query.toLowerCase();
  return assessments.filter(a =>
    a.gender.toLowerCase().includes(term) ||
    a.riskCategory.toLowerCase().includes(term) ||
    a.smokingHistory.toLowerCase().includes(term) ||
    String(a.age).includes(term) ||
    String(a.bmi).includes(term) ||
    String(a.hba1cLevel).includes(term) ||
    String(a.bloodGlucoseLevel).includes(term)
  );
}
