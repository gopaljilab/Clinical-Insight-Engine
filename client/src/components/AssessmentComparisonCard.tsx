import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { type AssessmentResponse } from "@shared/routes";
import AssessmentSelector from "@/components/AssessmentSelector";
import ComparisonTable from "@/components/ComparisonTable";

interface Props {
  assessments: AssessmentResponse[];
}

export default function AssessmentComparisonCard({
  assessments,
}: Props) {
  const sortedAssessments = useMemo(
    () =>
      [...assessments].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      ),
    [assessments]
  );

  const [leftId, setLeftId] = useState<string | null>(null);
  const [rightId, setRightId] = useState<string | null>(null);

  useEffect(() => {
    if (sortedAssessments.length >= 2) {
      setLeftId((current) => current ?? String(sortedAssessments[0].id));
      setRightId((current) =>
        current && current !== String(sortedAssessments[0].id)
          ? current
          : String(sortedAssessments[1].id)
      );
    } else if (sortedAssessments.length === 1) {
      setLeftId(String(sortedAssessments[0].id));
      setRightId(null);
    }
  }, [sortedAssessments]);

  const leftAssessment = useMemo(
    () => sortedAssessments.find((assessment) => String(assessment.id) === leftId) || null,
    [sortedAssessments, leftId]
  );

  const rightAssessment = useMemo(
    () => sortedAssessments.find((assessment) => String(assessment.id) === rightId) || null,
    [sortedAssessments, rightId]
  );

  const formatSummary = (assessment: AssessmentResponse | null) => {
    if (!assessment) return "No assessment selected";

    const date = assessment.createdAt
      ? format(new Date(assessment.createdAt), "MMM d, yyyy")
      : "Unknown date";
    const risk = assessment.riskScore !== undefined && assessment.riskScore !== null
      ? `${Number(assessment.riskScore).toFixed(1)}%`
      : "N/A";

    return `${assessment.patientName || "Patient"} — ${date} · ${risk}`;
  };

  return (
    <section className="mb-6 rounded-3xl border border-border bg-card p-6 md:p-8 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Assessment comparison
          </p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">
            Compare two history entries
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Choose two assessments from your current history results to see side-by-side changes for risk, vitals, and clinical status.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 w-full max-w-2xl">
          <AssessmentSelector
            label="Assessment A"
            assessments={sortedAssessments}
            selectedId={leftId}
            excludeId={rightId}
            onChange={setLeftId}
            disabled={sortedAssessments.length < 2}
          />
          <AssessmentSelector
            label="Assessment B"
            assessments={sortedAssessments}
            selectedId={rightId}
            excludeId={leftId}
            onChange={setRightId}
            disabled={sortedAssessments.length < 2}
          />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {sortedAssessments.length < 2 ? null : !leftAssessment || !rightAssessment ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/10 p-6 text-center text-sm text-muted-foreground">
            Select two different assessments to see a side-by-side comparison.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-border bg-slate-50 dark:bg-slate-900 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Assessment A
                </p>
                <p className="mt-2 text-sm text-foreground">{formatSummary(leftAssessment)}</p>
              </div>
              <div className="rounded-3xl border border-border bg-slate-50 dark:bg-slate-900 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Assessment B
                </p>
                <p className="mt-2 text-sm text-foreground">{formatSummary(rightAssessment)}</p>
              </div>
            </div>

            <ComparisonTable leftAssessment={leftAssessment} rightAssessment={rightAssessment} />
          </div>
        )}
      </div>
    </section>
  );
}
