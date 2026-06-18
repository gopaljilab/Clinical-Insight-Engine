import React from "react";
import { useTranslation } from "react-i18next";

export function SimulatorInputs({ values, handleFieldChange }: { values: any, handleFieldChange: (field: any, value: string) => void }) {
  const { t } = useTranslation();
  const smokingStatusOptions = [
    { label: t("simulator.neverSmoked"), value: "never" },
    { label: t("simulator.formerSmoker"), value: "former" },
    { label: t("simulator.currentSmoker"), value: "current" },
    { label: t("simulator.noInfo"), value: "No Info" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2">
        <span className="text-sm font-semibold text-foreground">{t("simulator.bmi")}</span>
        <input
          type="number"
          value={values.bmi}
          min={10}
          max={60}
          step={0.1}
          onChange={(event) => handleFieldChange("bmi", event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </label>
      <label className="space-y-2">
        <span className="text-sm font-semibold text-foreground">{t("simulator.hba1c")}</span>
        <input
          type="number"
          value={values.hba1cLevel}
          min={3}
          max={15}
          step={0.1}
          onChange={(event) => handleFieldChange("hba1cLevel", event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </label>
      <label className="space-y-2">
        <span className="text-sm font-semibold text-foreground">{t("simulator.bloodGlucose")}</span>
        <input
          type="number"
          value={values.bloodGlucoseLevel}
          min={50}
          max={400}
          step={1}
          onChange={(event) => handleFieldChange("bloodGlucoseLevel", event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        />
      </label>
      <label className="space-y-2">
        <span className="text-sm font-semibold text-foreground">{t("simulator.smokingStatus")}</span>
        <select
          value={values.smokingHistory}
          onChange={(event) => handleFieldChange("smokingHistory", event.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
        >
          {smokingStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
