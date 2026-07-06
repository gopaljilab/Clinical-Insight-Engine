import React from "react";
import { cn } from "@/lib/utils";
type Variant = "low" | "moderate" | "high" | "default";

export default function StatusPill({
  variant = "default",
  label,
  highlightedLabel,
}: {
  variant?: Variant;
  label?: string;
  highlightedLabel?: React.ReactNode;
}) {
  const mapping: Record<Variant, string> = {
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    moderate: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    default: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  };

  const colorClasses = mapping[variant] ?? mapping.default;
  const display = label ?? variant.toUpperCase();

  return (
    <span
      role="status"
      aria-label={`Risk: ${display}`}
      title={`Risk: ${display}`}
      className={cn("px-3 py-1 rounded-full text-xs font-bold tracking-wide", colorClasses)}
    >
      {highlightedLabel ?? display}
    </span>
  );
}
