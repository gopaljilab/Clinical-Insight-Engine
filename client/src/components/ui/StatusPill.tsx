import React from "react";

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
  const mapping: Record<Variant, { bg: string; text: string }> = {
    low: { bg: "#E6F4EA", text: "#065f46" }, // soft green bg, dark green text
    moderate: { bg: "#FEF7E0", text: "#92400e" }, // soft amber bg, dark amber text
    high: { bg: "#FCE8E6", text: "#7f1d1d" }, // soft red bg, dark red text
    default: { bg: "#F3F4F6", text: "#374151" },
  };

  const { bg, text } = mapping[variant] ?? mapping.default;
  const display = label ?? variant.toUpperCase();

  return (
    <span
      role="status"
      aria-label={`Risk: ${display}`}
      title={`Risk: ${display}`}
      style={{ backgroundColor: bg, color: text }}
      className="px-3 py-1 rounded-full text-xs font-bold tracking-wide"
    >
      {highlightedLabel ?? display}
    </span>
  );
}
