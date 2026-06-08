import React from "react";

type AttentionPriority = {
  factor: string;
  priority: "high" | "moderate" | "monitor";
  reason: string;
  value?: number;
};

type AttentionNavigator = {
  priorities: AttentionPriority[];
};

const PRIORITY_STYLES: Record<"high" | "moderate" | "monitor", string> = {
  high: "bg-rose-100 text-rose-800 border-rose-200",
  moderate: "bg-amber-100 text-amber-900 border-amber-200",
  monitor: "bg-emerald-100 text-emerald-900 border-emerald-200",
};

export function ClinicalAttentionNavigator({ navigator }: { navigator?: AttentionNavigator }) {
  if (!navigator || !navigator.priorities || navigator.priorities.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Clinical Attention Navigator</p>
        <h3 className="mt-2 text-xl font-bold text-foreground">Priority findings for clinician review</h3>
      </div>
      <div className="grid gap-4">
        {navigator.priorities.map((item: AttentionPriority) => (
          <article
            key={item.factor}
            className="rounded-3xl border border-border/70 bg-muted/80 p-4 shadow-sm sm:flex sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${PRIORITY_STYLES[item.priority]}`}>
                  {item.priority === "high" ? "High" : item.priority === "moderate" ? "Moderate" : "Monitor"}
                </span>
                <h4 className="text-base font-semibold text-foreground truncate">{item.factor}</h4>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.reason}</p>
              {typeof item.value === "number" && (
                <p className="mt-3 text-xs font-medium text-slate-500">Current value: {item.value}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ClinicalAttentionNavigator;
