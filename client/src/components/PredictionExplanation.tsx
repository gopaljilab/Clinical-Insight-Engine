import { Info, TrendingUp, TrendingDown } from "lucide-react";
import type { PredictionExplanation as PredictionExplanationType } from "@shared/routes";

export function PredictionExplanation({
  explanation,
  view,
}: {
  explanation?: PredictionExplanationType;
  view: "patient" | "clinician";
}) {
  if (!explanation) {
    return null;
  }

  const heading = view === "patient" ? "Explain this prediction" : "Prediction explanation";
  const description = view === "patient" ? explanation.patientSummary : explanation.clinicianSummary;

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <Info className="h-4 w-4" />
            {view === "patient" ? "Patient explanation" : "Clinician explanation"}
          </div>
          <h3 id="prediction-explanation-heading" className="mt-4 text-xl font-bold text-foreground">
            {heading}
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border/70 bg-muted p-5">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground">Top contributors</h4>
          <ul className="space-y-3">
            {explanation.topContributors.map((factor) => (
              <li key={factor.name} className="rounded-2xl bg-background p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">{factor.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{factor.description}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      factor.impact === "positive"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {factor.impact === "positive" ? "Risk" : "Protective"}
                  </span>
                </div>
                <div className="mt-3 rounded-full bg-slate-100 h-2 overflow-hidden">
                  <div
                    className={`h-full ${
                      factor.impact === "positive" ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${factor.strength}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{factor.why}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-border/70 bg-muted p-5">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground mb-3">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              Positive contributors
            </div>
            <ul className="space-y-3">
              {explanation.strongestPositive.length > 0 ? (
                explanation.strongestPositive.map((factor) => (
                  <li key={factor.name} className="rounded-2xl bg-background p-4">
                    <p className="font-semibold text-foreground">{factor.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{factor.description}</p>
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">No strong positive contributors were identified.</li>
              )}
            </ul>
          </div>
          <div className="rounded-3xl border border-border/70 bg-muted p-5">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-foreground mb-3">
              <TrendingDown className="h-4 w-4 text-emerald-600" />
              Negative contributors
            </div>
            <ul className="space-y-3">
              {explanation.strongestNegative.length > 0 ? (
                explanation.strongestNegative.map((factor) => (
                  <li key={factor.name} className="rounded-2xl bg-background p-4">
                    <p className="font-semibold text-foreground">{factor.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{factor.description}</p>
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">No protective contributors were identified.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
