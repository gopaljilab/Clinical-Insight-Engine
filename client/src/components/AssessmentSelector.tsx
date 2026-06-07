import { format } from "date-fns";
import { type AssessmentResponse } from "@shared/routes";

interface AssessmentSelectorProps {
  label: string;
  assessments: AssessmentResponse[];
  selectedId: string | number | null;
  onChange: (id: string) => void;
  excludeId?: string | number | null;
  disabled?: boolean;
}

export default function AssessmentSelector({
  label,
  assessments,
  selectedId,
  onChange,
  excludeId,
  disabled,
}: AssessmentSelectorProps) {
  const formatOption = (assessment: AssessmentResponse) => {
    const dateValue = assessment.createdAt
      ? new Date(assessment.createdAt)
      : new Date();
    const dateLabel = isNaN(dateValue.getTime())
      ? "Unknown date"
      : format(dateValue, "MMM d, yyyy");
    const score = Number(assessment.riskScore);

    return `${assessment.patientName || "Patient"} • ${dateLabel} • ${
      !Number.isNaN(score) ? `${score.toFixed(1)}% risk` : "No risk score"
    }`;
  };

  return (
    <label className="block text-sm font-semibold text-foreground">
      <span className="mb-2 block text-sm font-semibold text-muted-foreground">{label}</span>
      <select
        value={selectedId ?? ""}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`w-full rounded-2xl border px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-4 ${
          disabled
            ? "border-dashed border-border bg-muted/30 text-muted-foreground cursor-not-allowed opacity-60"
            : "border-border bg-card text-foreground focus:border-blue-600 focus:ring-blue-600/20"
        }`}
      >
        <option value="" disabled>
          Select assessment
        </option>
        {assessments.map((assessment) => {
          const idString = String(assessment.id);
          const disabled = excludeId !== undefined && String(excludeId) === idString;
          return (
            <option key={idString} value={idString} disabled={disabled}>
              {formatOption(assessment)}
            </option>
          );
        })}
      </select>
    </label>
  );
}
