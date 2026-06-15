import type { Assessment } from "@shared/schema";

export type BiomarkerAlert = {
  biomarker: "HbA1c" | "Blood Glucose" | "BMI";
  trend: "increasing" | "decreasing" | "stable";
  severity: "warning" | "info";
  message: string;
  values: Array<{ ts?: string; value: number }>;
};

type AnalyzerInput = {
  assessments: Assessment[];
  lookback?: number; // number of most recent assessments to inspect
};

function extractSeries(assessments: Assessment[], key: keyof Assessment): Array<{ ts?: string; value: number }> {
  return assessments
    .filter((a) => a[key] != null)
    .map((a) => ({ ts: a.createdAt?.toISOString?.(), value: Number((a as any)[key]) }))
    .sort((x, y) => (x.ts || "") > (y.ts || "") ? 1 : -1);
}

function detectConsecutive(series: number[]): { increasing: number; decreasing: number; stable: number } {
  let inc = 0;
  let dec = 0;
  let stable = 0;
  for (let i = 1; i < series.length; i++) {
    if (series[i] > series[i - 1]) inc++; else if (series[i] < series[i - 1]) dec++; else stable++;
  }
  return { increasing: inc, decreasing: dec, stable };
}

export function analyzeBiomarkerTrends({ assessments, lookback = 8 }: AnalyzerInput): BiomarkerAlert[] {
  const alerts: BiomarkerAlert[] = [];

  // use most recent 'lookback' assessments
  const recent = assessments
    .slice()
    .sort((a, b) => (a.createdAt?.toISOString?.() || "") > (b.createdAt?.toISOString?.() || "") ? 1 : -1)
    .slice(-lookback);

  // HbA1c
  const hbaSeries = extractSeries(recent, "hba1cLevel");
  if (hbaSeries.length >= 2) {
    const values = hbaSeries.map((s) => s.value);
    const cons = detectConsecutive(values);
    // Check for 3 or more consecutive increases (i.e., inc >=3)
    if (cons.increasing >= 3) {
      alerts.push({
        biomarker: "HbA1c",
        trend: "increasing",
        severity: "warning",
        message: `HbA1c has increased across ${cons.increasing + 1} consecutive assessments.`,
        values: hbaSeries,
      });
    } else if (cons.increasing === 2) {
      alerts.push({
        biomarker: "HbA1c",
        trend: "increasing",
        severity: "info",
        message: `HbA1c has increased across ${cons.increasing + 1} consecutive assessments.`,
        values: hbaSeries,
      });
    } else if (cons.decreasing >= 3) {
      alerts.push({
        biomarker: "HbA1c",
        trend: "decreasing",
        severity: "info",
        message: `HbA1c has decreased across ${cons.decreasing + 1} consecutive assessments.`,
        values: hbaSeries,
      });
    }
  }

  // Blood glucose
  const gluSeries = extractSeries(recent, "bloodGlucoseLevel");
  if (gluSeries.length >= 2) {
    const values = gluSeries.map((s) => s.value);
    const cons = detectConsecutive(values);
    if (cons.increasing >= 3) {
      alerts.push({
        biomarker: "Blood Glucose",
        trend: "increasing",
        severity: "warning",
        message: `Blood glucose has increased across ${cons.increasing + 1} consecutive assessments.`,
        values: gluSeries,
      });
    } else if (cons.increasing === 2) {
      alerts.push({
        biomarker: "Blood Glucose",
        trend: "increasing",
        severity: "info",
        message: `Blood glucose has increased across ${cons.increasing + 1} consecutive assessments.`,
        values: gluSeries,
      });
    } else if (cons.decreasing >= 3) {
      alerts.push({
        biomarker: "Blood Glucose",
        trend: "decreasing",
        severity: "info",
        message: `Blood glucose has decreased across ${cons.decreasing + 1} consecutive assessments.`,
        values: gluSeries,
      });
    }
  }

  // BMI
  const bmiSeries = extractSeries(recent, "bmi");
  if (bmiSeries.length >= 2) {
    const values = bmiSeries.map((s) => s.value);
    const cons = detectConsecutive(values);
    if (cons.increasing >= 3) {
      alerts.push({
        biomarker: "BMI",
        trend: "increasing",
        severity: "warning",
        message: `BMI has increased across ${cons.increasing + 1} consecutive assessments.`,
        values: bmiSeries,
      });
    } else if (cons.decreasing >= 3) {
      alerts.push({
        biomarker: "BMI",
        trend: "decreasing",
        severity: "info",
        message: `BMI has decreased across ${cons.decreasing + 1} consecutive assessments.`,
        values: bmiSeries,
      });
    }
  }

  return alerts;
}

export default { analyzeBiomarkerTrends };
