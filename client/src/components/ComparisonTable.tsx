import StatusPill from "@/components/ui/StatusPill";
import MetricChangeIndicator from "@/components/MetricChangeIndicator";
import { ClinicalTooltip } from "@/components/ClinicalTooltip";
import { type AssessmentResponse } from "@shared/routes";

interface ComparisonTableProps {
  leftAssessment: AssessmentResponse;
  rightAssessment: AssessmentResponse;
}

type ComparisonRow = {
  label: string;
  leftDisplay: string;
  rightDisplay: string;
  leftCompare: unknown;
  rightCompare: unknown;
  tooltipKey?: "hba1c" | "bloodGlucose" | "bmi";
};

function normalizeStatus(value: unknown) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return String(value ?? "N/A");
}

function normalizeRiskCategory(value: string | undefined) {
  if (!value) return "Unknown";
  return value.toUpperCase();
}

function getRiskCategoryRank(category: string) {
  const rank: Record<string, number> = {
    LOW: 1,
    MODERATE: 2,
    HIGH: 3,
  };
  return rank[category.toUpperCase()] ?? 2;
}

function getComparisonType(label: string, leftValue: unknown, rightValue: unknown) {
  if (label === "Age") {
    if (Number(leftValue) === Number(rightValue)) return { type: "stable" as const, label: "No change" };
    const diff = Number(rightValue) - Number(leftValue);
    return {
      type: "neutral" as const,
      label: diff > 0 ? `Older by ${Math.abs(diff).toFixed(0)} yr` : `Younger by ${Math.abs(diff).toFixed(0)} yr`,
    };
  }

  if (label === "BMI" || label === "HbA1c Level" || label === "Blood Glucose Level" || label === "Risk Percentage") {
    const leftNum = Number(leftValue);
    const rightNum = Number(rightValue);

    if (Number.isNaN(leftNum) || Number.isNaN(rightNum)) {
      return { type: "unknown" as const, label: "N/A" };
    }

    if (leftNum === rightNum) return { type: "stable" as const, label: "No change" };
    return leftNum > rightNum
      ? { type: "improved" as const, label: `Lower by ${Math.abs(rightNum - leftNum).toFixed(1)}` }
      : { type: "regressed" as const, label: `Higher by ${Math.abs(rightNum - leftNum).toFixed(1)}` };
  }

  if (label === "Risk Category") {
    const leftCat = normalizeRiskCategory(String(leftValue));
    const rightCat = normalizeRiskCategory(String(rightValue));
    if (leftCat === rightCat) return { type: "stable" as const, label: "No change" };
    return getRiskCategoryRank(rightCat) < getRiskCategoryRank(leftCat)
      ? { type: "improved" as const, label: `${leftCat} → ${rightCat}` }
      : { type: "regressed" as const, label: `${leftCat} → ${rightCat}` };
  }

  if (label === "Hypertension Status" || label === "Heart Disease Status") {
    const leftBool = String(leftValue).toLowerCase() === "yes";
    const rightBool = String(rightValue).toLowerCase() === "yes";
    if (leftBool === rightBool) return { type: "stable" as const, label: "No change" };
    return leftBool && !rightBool
      ? { type: "improved" as const, label: "Resolved" }
      : { type: "regressed" as const, label: "Developed" };
  }

  if (label === "Smoking History") {
    const leftText = String(leftValue).toLowerCase();
    const rightText = String(rightValue).toLowerCase();
    if (leftText === rightText) return { type: "stable" as const, label: "No change" };
    const leftCurrent = leftText.includes("current") || leftText.includes("yes");
    const rightCurrent = rightText.includes("current") || rightText.includes("yes");
    if (leftCurrent && !rightCurrent) return { type: "improved" as const, label: "Less smoking" };
    if (!leftCurrent && rightCurrent) return { type: "regressed" as const, label: "More smoking" };
    return { type: "neutral" as const, label: `${String(leftValue)} → ${String(rightValue)}` };
  }

  return { type: "unknown" as const, label: "N/A" };
}

export default function ComparisonTable({ leftAssessment, rightAssessment }: ComparisonTableProps) {
  const rows: ComparisonRow[] = [
    {
      label: "Age",
      leftDisplay: String(leftAssessment.age ?? "N/A"),
      rightDisplay: String(rightAssessment.age ?? "N/A"),
      leftCompare: leftAssessment.age,
      rightCompare: rightAssessment.age,
    },
    {
      label: "BMI",
      leftDisplay: leftAssessment.bmi !== undefined ? Number(leftAssessment.bmi).toFixed(1) : "N/A",
      rightDisplay: rightAssessment.bmi !== undefined ? Number(rightAssessment.bmi).toFixed(1) : "N/A",
      leftCompare: leftAssessment.bmi,
      rightCompare: rightAssessment.bmi,
      tooltipKey: "bmi",
    },
    {
      label: "HbA1c Level",
      leftDisplay: leftAssessment.hba1cLevel !== undefined ? `${Number(leftAssessment.hba1cLevel).toFixed(1)}%` : "N/A",
      rightDisplay: rightAssessment.hba1cLevel !== undefined ? `${Number(rightAssessment.hba1cLevel).toFixed(1)}%` : "N/A",
      leftCompare: leftAssessment.hba1cLevel,
      rightCompare: rightAssessment.hba1cLevel,
      tooltipKey: "hba1c",
    },
    {
      label: "Blood Glucose Level",
      leftDisplay: leftAssessment.bloodGlucoseLevel !== undefined ? String(leftAssessment.bloodGlucoseLevel) : "N/A",
      rightDisplay: rightAssessment.bloodGlucoseLevel !== undefined ? String(rightAssessment.bloodGlucoseLevel) : "N/A",
      leftCompare: leftAssessment.bloodGlucoseLevel,
      rightCompare: rightAssessment.bloodGlucoseLevel,
      tooltipKey: "bloodGlucose",
    },
    {
      label: "Hypertension Status",
      leftDisplay: normalizeStatus(leftAssessment.hypertension),
      rightDisplay: normalizeStatus(rightAssessment.hypertension),
      leftCompare: normalizeStatus(leftAssessment.hypertension),
      rightCompare: normalizeStatus(rightAssessment.hypertension),
    },
    {
      label: "Heart Disease Status",
      leftDisplay: normalizeStatus(leftAssessment.heartDisease),
      rightDisplay: normalizeStatus(rightAssessment.heartDisease),
      leftCompare: normalizeStatus(leftAssessment.heartDisease),
      rightCompare: normalizeStatus(rightAssessment.heartDisease),
    },
    {
      label: "Smoking History",
      leftDisplay: leftAssessment.smokingHistory || "N/A",
      rightDisplay: rightAssessment.smokingHistory || "N/A",
      leftCompare: leftAssessment.smokingHistory || "N/A",
      rightCompare: rightAssessment.smokingHistory || "N/A",
    },
    {
      label: "Risk Category",
      leftDisplay: normalizeRiskCategory(leftAssessment.riskCategory),
      rightDisplay: normalizeRiskCategory(rightAssessment.riskCategory),
      leftCompare: normalizeRiskCategory(leftAssessment.riskCategory),
      rightCompare: normalizeRiskCategory(rightAssessment.riskCategory),
    },
    {
      label: "Risk Percentage",
      leftDisplay:
        leftAssessment.riskScore !== undefined && leftAssessment.riskScore !== null
          ? `${Number(leftAssessment.riskScore).toFixed(1)}%`
          : "N/A",
      rightDisplay:
        rightAssessment.riskScore !== undefined && rightAssessment.riskScore !== null
          ? `${Number(rightAssessment.riskScore).toFixed(1)}%`
          : "N/A",
      leftCompare: leftAssessment.riskScore,
      rightCompare: rightAssessment.riskScore,
    },
  ];

  const leftCategory = normalizeRiskCategory(leftAssessment.riskCategory);
  const rightCategory = normalizeRiskCategory(rightAssessment.riskCategory);

  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-card shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="p-4">Metric</th>
            <th className="p-4">Assessment A</th>
            <th className="p-4">Assessment B</th>
            <th className="p-4">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const { type, label } = getComparisonType(row.label, row.leftCompare, row.rightCompare);
            return (
              <tr key={row.label} className="hover:bg-muted/40 transition-colors">
                <td className="p-4 font-medium text-foreground whitespace-nowrap">
                  {row.tooltipKey ? (
                    <ClinicalTooltip metric={row.tooltipKey}>
                      {row.label}
                    </ClinicalTooltip>
                  ) : (
                    row.label
                  )}
                </td>
                <td className="p-4 text-foreground whitespace-nowrap">{row.leftDisplay}</td>
                <td className="p-4 text-foreground whitespace-nowrap">{row.rightDisplay}</td>
                <td className="p-4">
                  <MetricChangeIndicator type={type} label={label} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-col gap-3 p-4 bg-muted/10 border-t border-border sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Category preview</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill variant={leftCategory === "LOW" ? "low" : leftCategory === "MODERATE" ? "moderate" : leftCategory === "HIGH" ? "high" : "default"} label={`A: ${leftCategory}`} />
            <StatusPill variant={rightCategory === "LOW" ? "low" : rightCategory === "MODERATE" ? "moderate" : rightCategory === "HIGH" ? "high" : "default"} label={`B: ${rightCategory}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
