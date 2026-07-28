import React from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GenderFilterValue } from "@/utils/filterAssessments";

const OPTIONS: Array<{ label: string; value: GenderFilterValue }> = [
  { label: "All", value: "All" },
  { label: "Male", value: "Male" },
  { label: "Female", value: "Female" },
  { label: "Other", value: "Other" },
];

interface GenderFilterProps {
  value: GenderFilterValue;
  onChange: (value: GenderFilterValue) => void;
}

export function GenderFilter({ value, onChange }: GenderFilterProps) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Gender</p>
        <span className="text-xs text-muted-foreground">Filter by patient gender</span>
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

