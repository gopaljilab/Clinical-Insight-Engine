import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
type ChangeType = "improved" | "regressed" | "stable" | "neutral" | "unknown";

interface MetricChangeIndicatorProps {
  type: ChangeType;
  value?: number | string | null;
  label?: string;
}

const CHANGE_META: Record<ChangeType, { text: string; classes: string; Icon: typeof ArrowDownRight | typeof ArrowUpRight | typeof Minus }> = {
  improved: {
    text: "Improved",
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
    Icon: ArrowDownRight,
  },
  regressed: {
    text: "Regressed",
    classes: "bg-rose-100 text-rose-800 dark:bg-rose-900/20 dark:text-rose-300",
    Icon: ArrowUpRight,
  },
  stable: {
    text: "No change",
    classes: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    Icon: Minus,
  },
  neutral: {
    text: "Neutral",
    classes: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    Icon: Minus,
  },
  unknown: {
    text: "Unknown",
    classes: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    Icon: Minus,
  },
};

export default function MetricChangeIndicator({
  type,
  value,
  label,
}: MetricChangeIndicatorProps) {
  const meta = CHANGE_META[type] ?? CHANGE_META.unknown;
  const Icon = meta.Icon;
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", meta.classes)}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label ?? meta.text}{value !== undefined && value !== null ? ` ${value}` : ""}</span>
    </div>
  );
}
