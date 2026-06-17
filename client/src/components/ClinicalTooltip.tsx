import { type ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { referenceData, type ClinicalMetricKey } from "@/lib/referenceData";
import { cn } from "@/lib/utils";

interface ClinicalTooltipProps {
  metric: ClinicalMetricKey;
  children?: ReactNode;
  className?: string;
}

export function ClinicalTooltip({ metric, children, className }: ClinicalTooltipProps) {
  const metricData = referenceData[metric];

  if (!metricData) {
    return <span className={cn("text-foreground", className)}>{children ?? metric}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-transparent bg-transparent text-sm font-semibold text-primary outline-none transition hover:text-primary/90 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            className
          )}
        >
          {children ?? metricData.title}
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{metricData.title}</p>
          <ul className="list-disc pl-4 text-sm leading-6 text-muted-foreground">
            {metricData.ranges.map((range) => (
              <li key={range}>{range}</li>
            ))}
          </ul>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
