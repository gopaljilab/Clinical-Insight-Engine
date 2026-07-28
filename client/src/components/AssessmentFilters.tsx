import React from 'react';
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

