import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { BiomarkerAlert } from "@shared/routes";
import { formatCompactDate } from "@/utils/dateFormat";
import { useTranslation } from "react-i18next";

export function BiomarkerAlerts({ alerts }: { alerts?: BiomarkerAlert[] }) {
  const { t } = useTranslation();
  if (!alerts || alerts.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-bold text-lg mb-4">{t("biomarkerAlerts.title")}</h3>
      <div className="grid gap-4">
        {alerts.map((a) => (
          <article key={`${a.biomarker}-${a.trend}`} className="rounded-lg border border-border/60 bg-muted/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{a.biomarker}</p>
                <p className="text-xs text-muted-foreground mt-1">{a.message}</p>
                <div className="mt-3 text-xs text-muted-foreground">{t("biomarkerAlerts.trend", { value: a.trend })} • {t("biomarkerAlerts.severity", { value: a.severity })}</div>
              </div>
              <div style={{ width: 180, height: 80 }} className="shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={a.values.map((v) => ({ ...v, label: formatCompactDate(v.ts, "") }))}>
                    <XAxis dataKey="label" hide />
                    <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default BiomarkerAlerts;
