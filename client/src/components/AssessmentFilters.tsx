import { Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AgeRangeFilter } from "@/components/AgeRangeFilter";
import { GenderFilter } from "@/components/GenderFilter";
import { RiskCategoryFilter } from "@/components/RiskCategoryFilter";
import type {
  GenderFilterValue,
  RiskCategoryFilterValue,
} from "@/utils/filterAssessments";

interface AssessmentFiltersProps {
  riskCategory: RiskCategoryFilterValue;
  gender: GenderFilterValue;
  minAge?: number;
  maxAge?: number;
  startDate: string;
  endDate: string;
  onRiskChange: (value: RiskCategoryFilterValue) => void;
  onGenderChange: (value: GenderFilterValue) => void;
  onAgeChange: (next: { minAge?: number; maxAge?: number }) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClearDateRange: () => void;
}

export function AssessmentFilters({
  riskCategory,
  gender,
  minAge,
  maxAge,
  startDate,
  endDate,
  onRiskChange,
  onGenderChange,
  onAgeChange,
  onStartDateChange,
  onEndDateChange,
  onClearDateRange,
}: AssessmentFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <RiskCategoryFilter value={riskCategory} onChange={onRiskChange} />
        <GenderFilter value={gender} onChange={onGenderChange} />
        <AgeRangeFilter minAge={minAge} maxAge={maxAge} onChange={onAgeChange} />
      </div>

      <div className="rounded-3xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Assessment date range</p>
            <p className="text-xs text-muted-foreground">Filter records by created date.</p>
          </div>
          { (startDate || endDate) && (
            <button
              type="button"
              onClick={onClearDateRange}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Clear dates
            </button>
          ) }
        </div>

        {/* Date presets */}
        {(() => {
          const now = new Date();
          const formatDate = (d: Date) => {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            return `${yyyy}-${mm}-${dd}`;
          };

          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);

          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);

          const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
          const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1);

          const yearStart = new Date(now.getFullYear(), 0, 1);
          const todayStr = formatDate(now);

          const presets = {
            last7: { start: formatDate(sevenDaysAgo), end: todayStr },
            last30: { start: formatDate(thirtyDaysAgo), end: todayStr },
            quarter: { start: formatDate(quarterStart), end: todayStr },
            year: { start: formatDate(yearStart), end: todayStr },
            all: { start: "", end: "" }
          };

          let activePreset: "last7" | "last30" | "quarter" | "year" | "all" | null = null;
          if (startDate === presets.last7.start && endDate === presets.last7.end) activePreset = "last7";
          else if (startDate === presets.last30.start && endDate === presets.last30.end) activePreset = "last30";
          else if (startDate === presets.quarter.start && endDate === presets.quarter.end) activePreset = "quarter";
          else if (startDate === presets.year.start && endDate === presets.year.end) activePreset = "year";
          else if (startDate === "" && endDate === "") activePreset = "all";

          return (
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { id: "last7", label: "Last 7 Days", dates: presets.last7 },
                { id: "last30", label: "Last 30 Days", dates: presets.last30 },
                { id: "quarter", label: "This Quarter", dates: presets.quarter },
                { id: "year", label: "This Year", dates: presets.year },
                { id: "all", label: "All Time", dates: presets.all },
              ].map((p) => {
                const isActive = activePreset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onStartDateChange(p.dates.start);
                      onEndDateChange(p.dates.end);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                      isActive
                        ? "bg-slate-900 border-slate-900 text-white dark:bg-slate-100 dark:border-slate-100 dark:text-slate-950 shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/50"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          );
        })()}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-2 text-sm text-foreground">
            <span>Start date</span>
            <div className="relative">
              <Input
                type="date"
                value={startDate}
                onChange={(event) => onStartDateChange(event.target.value)}
                className="pl-10"
              />
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>
          <label className="space-y-2 text-sm text-foreground">
            <span>End date</span>
            <div className="relative">
              <Input
                type="date"
                value={endDate}
                onChange={(event) => onEndDateChange(event.target.value)}
                className="pl-10"
              />
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
