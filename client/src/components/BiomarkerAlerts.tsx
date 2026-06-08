import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { BiomarkerAlert } from "@shared/routes";

export function BiomarkerAlerts({ alerts }: { alerts?: BiomarkerAlert[] }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h3 className="font-bold text-lg mb-4">Emerging biomarker alerts</h3>
      <div className="grid gap-4">
        {alerts.map((a) => (
          <article key={`${a.biomarker}-${a.trend}`} className="rounded-lg border border-border/60 bg-muted/10 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">{a.biomarker}</p>
                <p className="text-xs text-muted-foreground mt-1">{a.message}</p>
                <div className="mt-3 text-xs text-muted-foreground">Trend: <strong className="ml-1">{a.trend}</strong> • Severity: <strong className="ml-1">{a.severity}</strong></div>
              </div>
              <div style={{ width: 180, height: 80 }} className="shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={a.values.map((v) => ({ ...v, label: v.ts ? new Date(v.ts).toLocaleDateString() : "" }))}>
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
