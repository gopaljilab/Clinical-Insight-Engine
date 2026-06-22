import React from "react";

export default function ConfidenceRange({
  low,
  high,
  value,
  width = 120,
}: {
  low: number | null | undefined;
  high: number | null | undefined;
  value?: number | null | undefined;
  width?: number;
}) {
  if (low == null || high == null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const clampedLow = Math.max(0, Math.min(100, low));
  const clampedHigh = Math.max(0, Math.min(100, high));
  const range = Math.max(0.5, clampedHigh - clampedLow);

  const left = (clampedLow / 100) * width;
  const rangeWidth = (range / 100) * width;
  const marker = value != null ? Math.max(0, Math.min(100, value)) : null;
  const markerLeft = marker != null ? (marker / 100) * width : null;

  return (
    <div className="flex items-center gap-2" title={`${clampedLow.toFixed(1)}% — ${clampedHigh.toFixed(1)}%`} aria-label={`Confidence interval: ${clampedLow.toFixed(1)}% to ${clampedHigh.toFixed(1)}%`}>
      <div style={{ width }} className="relative h-3 rounded-full bg-slate-100">
        <div
          style={{ left, width: rangeWidth }}
          className="absolute h-3 rounded-full bg-blue-200 dark:bg-blue-900/40"
        />
        {markerLeft != null && (
          <div
            style={{ left: Math.max(0, Math.min(width - 6, markerLeft - 3)) }}
            className="absolute -top-1 h-5 w-5 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[10px] font-black text-slate-400"
            aria-hidden
          >
            <div className="h-1 w-1 rounded-full bg-slate-400" />
          </div>
        )}
      </div>
      <div className="hidden sm:block text-[11px] text-muted-foreground font-medium">
        {clampedLow.toFixed(1)}% — {clampedHigh.toFixed(1)}%
      </div>
    </div>
  );
}
