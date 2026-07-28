import React from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RiskCategoryFilterValue } from "@/utils/filterAssessments";

const OPTIONS: Array<{ label: string; value: RiskCategoryFilterValue }> = [
  { label: "All", value: "All" },
  { label: "Low", value: "Low" },
  { label: "Moderate", value: "Moderate" },
  { label: "High", value: "High" },
];

interface RiskCategoryFilterProps {
  value: RiskCategoryFilterValue;
  onChange: (value: RiskCategoryFilterValue) => void;
}

export function RiskCategoryFilter({ value, onChange }: RiskCategoryFilterProps) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Risk category</p>
        <span className="text-xs text-muted-foreground">Filter by risk labels</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <Button
              key={option.value}
              variant={selected ? "default" : "outline"}
              size="sm"
              className={cn(
                "capitalize",
                selected ? "bg-primary text-primary-foreground" : "bg-background"
              )}
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

