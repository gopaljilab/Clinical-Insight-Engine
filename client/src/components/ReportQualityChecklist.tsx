import { CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  hasSummary: boolean;
  hasFindings: boolean;
  hasRecommendations: boolean;
  hasReferences: boolean;
}

export function ReportQualityChecklist({
  hasSummary,
  hasFindings,
  hasRecommendations,
  hasReferences,
}: Props) {
  const items = [
    { label: "Summary", ok: hasSummary },
    { label: "Findings", ok: hasFindings },
    { label: "Recommendations", ok: hasRecommendations },
    { label: "References", ok: hasReferences },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-bold text-lg mb-4">
        Report Quality Checklist
      </h3>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <span className="font-medium">{item.label}</span>

            {item.ok ? (
              <span className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Present
              </span>
            ) : (
              <span className="flex items-center gap-2 text-amber-600 font-medium">
                <AlertTriangle className="w-4 h-4" />
                Missing
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}