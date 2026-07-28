import React from "react";
import { cn } from "@/lib/utils";
export type PriorityLevel = "high" | "moderate" | "monitor";

export interface AttentionNavigatorItem {
  factor: string;
  priority: PriorityLevel;
  reason: string;
  value?: number;
}

export interface AttentionNavigator {
  priorities: AttentionNavigatorItem[];
}

interface NavigatorProps {
  priorities: AttentionNavigatorItem[];
}

const PRIORITY_STYLES: Record<PriorityLevel, string> = {
  high: "bg-rose-100 text-rose-800 border-rose-200",
  moderate: "bg-amber-100 text-amber-900 border-amber-200",
  monitor: "bg-emerald-100 text-emerald-900 border-emerald-200",
};
const getCategory = (factor: string) => {
  const text = factor.toLowerCase();

  if (
    text.includes("blood pressure") ||
    text.includes("cholesterol") ||
    text.includes("ldl") ||
    text.includes("hdl") ||
    text.includes("heart") ||
    text.includes("cardio")
  ) {
    return { label: "🫀 Cardiovascular" };
  }

  if (
    text.includes("lung") ||
    text.includes("respiratory") ||
    text.includes("oxygen")
  ) {
    return { label: "🫁 Respiratory" };
  }

  if (
    text.includes("hemoglobin") ||
    text.includes("blood") ||
    text.includes("platelet")
  ) {
    return { label: "🩸 Hematology" };
  }

  if (
    text.includes("brain") ||
    text.includes("neuro")
  ) {
    return { label: "🧠 Neurology" };
  }

  if (
    text.includes("bone") ||
    text.includes("joint") ||
    text.includes("muscle")
  ) {
    return { label: "🦴 Musculoskeletal" };
  }

  return { label: "General" };
};
export function ClinicalAttentionNavigator({ navigator }: { navigator?: NavigatorProps }) {
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
  {navigator.priorities.map((item: AttentionNavigatorItem) => {
    const category = getCategory(item.factor);

    return (
      <article
        key={item.factor}
        className="rounded-3xl border border-border/70 bg-muted/80 p-4 shadow-sm sm:flex sm:items-start sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border",
                PRIORITY_STYLES[item.priority]
              )}
            >
              {item.priority === "high"
                ? "High"
                : item.priority === "moderate"
                ? "Moderate"
                : "Monitor"}
            </span>

            <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              {category.label}
            </span>
          </div>

          <h4 className="mt-3 text-base font-semibold text-foreground">
            {item.factor}
          </h4>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {item.reason}
          </p>

          {typeof item.value === "number" && (
            <p className="mt-3 text-xs font-medium text-slate-500">
              Current value: {item.value}
            </p>
          )}
        </div>
      </article>
    );
  })}
      </div>
    </section>
  );
}