import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

interface AgeRangeFilterProps {
  minAge?: number;
  maxAge?: number;
  onChange: (next: { minAge?: number; maxAge?: number }) => void;
}

export function AgeRangeFilter({ minAge, maxAge, onChange }: AgeRangeFilterProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">{t("Age range")}</p>
        <p className="text-xs text-muted-foreground">{t("Show assessments within a specific age window.")}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2 text-sm text-foreground">
          <span>{t("Min age")}</span>
          <Input
            value={minAge ?? ""}
            type="number"
            min={0}
            step={1}
            onChange={(event) => {
              const value = event.target.value;
              onChange({ minAge: value === "" ? undefined : Number(value), maxAge });
            }}
            placeholder="e.g. 30"
          />
        </label>
        <label className="space-y-2 text-sm text-foreground">
          <span>{t("Max age")}</span>
          <Input
            value={maxAge ?? ""}
            type="number"
            min={0}
            step={1}
            onChange={(event) => {
              const value = event.target.value;
              onChange({ minAge, maxAge: value === "" ? undefined : Number(value) });
            }}
            placeholder="e.g. 65"
          />
        </label>
      </div>
    </div>
  );
}
