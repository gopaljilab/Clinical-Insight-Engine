import { ReactNode } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { clinicalTerminology } from "@/lib/clinicalTerminology";

interface MedicalTermTooltipProps {
  term: keyof typeof clinicalTerminology;
  children: ReactNode;
}

export function MedicalTermTooltip({
  term,
  children,
}: MedicalTermTooltipProps) {
  const info = clinicalTerminology[term];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted text-primary font-medium">
          {children}
        </span>
      </TooltipTrigger>

      <TooltipContent className="max-w-xs">
        <div>
          <p className="font-semibold">{info.title}</p>
          <p className="text-sm">{info.description}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}