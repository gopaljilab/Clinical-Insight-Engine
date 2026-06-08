import React from "react";
import type { Recommendation } from "@shared/routes";
import { CheckCircle2, Clipboard, Heart } from "lucide-react";

export function Recommendations({
  recommendations,
  audience = "patient",
}: {
  recommendations?: Recommendation[];
  audience?: "patient" | "clinician" | "both";
}) {
  if (!recommendations || recommendations.length === 0) return null;

  // Filter by audience
  const filtered = recommendations.filter((r) => {
    if (r.audience === "both" || !r.audience) return true;
    return r.audience === audience;
  });

  if (filtered.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Heart className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-lg">Recommendations</h3>
      </div>
      <div className="grid gap-3">
        {filtered.map((rec) => (
          <label
            key={rec.id}
            className="flex items-start gap-3 p-4 rounded-lg border border-border/60 bg-muted/10"
          >
            <input
              aria-label={rec.title}
              type="checkbox"
              className="mt-1 w-4 h-4 rounded text-primary"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-foreground">{rec.title}</div>
                {rec.urgency === "high" && (
                  <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">High</span>
                )}
                {rec.urgency === "medium" && (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Med</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default Recommendations;
