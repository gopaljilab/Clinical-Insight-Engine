import type { Assessment } from "@shared/schema";

export type QualityAlert = {
  severity: "warning" | "info";
  message: string;
  code?: string;
};

type CheckerInput = Partial<Assessment> & { factors?: Assessment["factors"] };

function isLikelyUnitError(input: CheckerInput): QualityAlert[] {
  const alerts: QualityAlert[] = [];
  const hba1c = Number(input.hba1cLevel ?? NaN);
  const glucose = Number(input.bloodGlucoseLevel ?? NaN);

  // HbA1c above 20 is likely entered as a percentage vs mmol/mol or wrong units
  if (!Number.isNaN(hba1c) && hba1c > 20) {
    alerts.push({
      severity: "warning",
      message: "Reported HbA1c is unusually high; please confirm units (percent vs mmol/mol) or data entry.",
      code: "UNIT_HBA1C_HIGH",
    });
  }

  // Blood glucose below 20 mg/dL likely unit error (mmol/L entered as mg/dL or vice versa)
  if (!Number.isNaN(glucose) && glucose > 0 && glucose < 20) {
    alerts.push({
      severity: "warning",
      message: "Blood glucose value is very low and may indicate a unit-entry mistake; verify mg/dL vs mmol/L.",
      code: "UNIT_GLUCOSE_LOW",
    });
  }

  return alerts;
}

function bmiHbA1cMismatch(input: CheckerInput): QualityAlert[] {
  const alerts: QualityAlert[] = [];
  const bmi = Number(input.bmi ?? NaN);
  const hba1c = Number(input.hba1cLevel ?? NaN);
  const glucose = Number(input.bloodGlucoseLevel ?? NaN);

  if (!Number.isNaN(bmi) && !Number.isNaN(hba1c)) {
    if (bmi < 18.5 && hba1c >= 9) {
      alerts.push({
        severity: "warning",
        message: "Low BMI combined with very high HbA1c is uncommon; consider re-checking measurements.",
        code: "LOWBMI_HIGHHBA1C",
      });
    }
  }

  if (!Number.isNaN(glucose) && !Number.isNaN(hba1c)) {
    // Normal fasting glucose but very high HbA1c may indicate reporting mismatch
    if (glucose >= 70 && glucose <= 130 && hba1c >= 9) {
      alerts.push({
        severity: "info",
        message: "Fasting glucose in a normal range but HbA1c is very high; check sample timing or lab units.",
        code: "NORMALGLUCOSE_HIGHHBA1C",
      });
    }
  }

  return alerts;
}

function youngAgeWithHeartDisease(input: CheckerInput): QualityAlert[] {
  const alerts: QualityAlert[] = [];
  const age = Number(input.age ?? NaN);
  if (!Number.isNaN(age) && age < 40 && input.heartDisease) {
    alerts.push({
      severity: "warning",
      message: "Heart disease in a young patient is uncommon; verify medical history entry.",
      code: "YOUNG_HEART_DISEASE",
    });
  }
  return alerts;
}

function extremeCombinationChecks(input: CheckerInput): QualityAlert[] {
  const alerts: QualityAlert[] = [];
  const bmi = Number(input.bmi ?? NaN);
  const hba1c = Number(input.hba1cLevel ?? NaN);
  const glucose = Number(input.bloodGlucoseLevel ?? NaN);

  // Extremely high HbA1c and extremely high glucose
  if (!Number.isNaN(hba1c) && !Number.isNaN(glucose)) {
    if (hba1c >= 14 && glucose >= 300) {
      alerts.push({
        severity: "warning",
        message: "Extremely high HbA1c and blood glucose reported; consider urgent clinical review and verify values.",
        code: "EXTREME_HYPERGLYCAEMIA",
      });
    }
  }

  // Very low BMI with extremely low glucose
  if (!Number.isNaN(bmi) && !Number.isNaN(glucose)) {
    if (bmi < 15 && glucose < 50) {
      alerts.push({
        severity: "info",
        message: "Very low BMI with low blood glucose may reflect malnutrition or measurement error.",
        code: "VERY_LOW_BMI_LOW_GLUCOSE",
      });
    }
  }

  return alerts;
}

export function generateQualityAlerts(input: CheckerInput): QualityAlert[] {
  const checks = [
    isLikelyUnitError,
    bmiHbA1cMismatch,
    youngAgeWithHeartDisease,
    extremeCombinationChecks,
  ];

  const out: QualityAlert[] = [];
  for (const check of checks) {
    const res = check(input);
    if (res && res.length) out.push(...res);
  }

  // Deduplicate by code+message
  const seen = new Set<string>();
  const deduped: QualityAlert[] = [];
  for (const a of out) {
    const key = `${a.code ?? ""}::${a.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(a);
    }
  }

  return deduped;
}

export default { generateQualityAlerts };
