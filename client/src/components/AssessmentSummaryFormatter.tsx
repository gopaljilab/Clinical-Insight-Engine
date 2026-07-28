import React, { type ReactNode } from "react";
import { formatAssessmentSummary } from "@/utils/formatAssessmentSummary";
import type { AssessmentResponse } from "@shared/routes";

interface AssessmentSummaryFormatterProps {
  assessment: AssessmentResponse;
  children: (summary: string) => ReactNode;
}

export function AssessmentSummaryFormatter({
  assessment,
  children,
}: AssessmentSummaryFormatterProps) {
  const summary = formatAssessmentSummary(assessment);
  return <>{children(summary)}</>;
}
