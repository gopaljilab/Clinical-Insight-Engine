import React from "react";
import type { QualityAlert } from "@shared/routes";
import { AlertTriangle, Info } from "lucide-react";

export function DataQualityAlerts({ alerts }: { alerts?: QualityAlert[] }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-yellow-50 p-4 shadow-sm" role="region" aria-live="polite">
      <h4 className="font-semibold mb-2">Data quality alerts</h4>
      <ul className="space-y-2">
        {alerts.map((a, i) => (
          <li key={`${a.code ?? a.message}-${i}`} className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {a.severity === "warning" ? (
                <AlertTriangle className="w-5 h-5 text-amber-700" />
              ) : (
                <Info className="w-5 h-5 text-sky-600" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{a.message}</p>
              {a.code && <p className="text-xs text-muted-foreground mt-0.5">Code: {a.code}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DataQualityAlerts;
