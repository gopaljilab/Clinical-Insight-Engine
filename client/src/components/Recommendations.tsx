import React from "react";
import type { Recommendation } from "@shared/routes";
import { Brain, Activity, Heart, Target, Salad } from "lucide-react";
import { useTranslation } from "react-i18next";

export function Recommendations({
  recommendations,
  audience = "patient",
}: {
  recommendations?: Recommendation[];
  audience?: "patient" | "clinician" | "both";
}) {
  const { t } = useTranslation();
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
  <Brain className="w-6 h-6 text-primary" />
  <div>
    <h3 className="font-bold text-lg">
      AI Personalized Diabetes Prevention Plan
    </h3>
    <p className="text-sm text-muted-foreground">
      Customized health goals and lifestyle recommendations based on your assessment.
    </p>
  </div>
</div>
      <div className="grid gap-3">
        {filtered.map((rec) => (
          <label
            key={rec.id}
            className="flex items-start gap-3 p-4 rounded-lg border border-primary/30 bg-primary/5 hover:shadow-md transition"
          >
            <input
              aria-label={rec.title}
              type="checkbox"
              className="mt-1 w-4 h-4 rounded text-primary"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  {rec.title.toLowerCase().includes("diet") && (
                    <Salad className="w-4 h-4 text-green-600" />
                  )}

                  {rec.title.toLowerCase().includes("exercise") && (
                    <Activity className="w-4 h-4 text-blue-600" />
                  )}

                  {rec.title.toLowerCase().includes("goal") && (
                    <Target className="w-4 h-4 text-purple-600" />
                  )}

                  {!rec.title.toLowerCase().includes("diet") &&
                    !rec.title.toLowerCase().includes("exercise") &&
                    !rec.title.toLowerCase().includes("goal") && (
                      <Heart className="w-4 h-4 text-primary" />
                    )}

                  <span>{rec.title}</span>
                </div>
                {rec.urgency === "high" && (
                  <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">{t("recommendations.high")}</span>
                )}
                {rec.urgency === "medium" && (
                  <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{t("recommendations.med")}</span>
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
