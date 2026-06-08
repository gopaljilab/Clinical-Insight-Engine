import { useQuery } from "@tanstack/react-query";
import type { Assessment } from "@shared/schema";

export type AnalyticsDistribution = {
  category: "LOW" | "MODERATE" | "HIGH";
  count: number;
};

export type AnalyticsAverages = {
  bmi: number;
  hba1c: number;
};

export type CriticalAlert = Pick<
  Assessment,
  "id" | "patientName" | "gender" | "age" | "riskScore" | "riskCategory" | "createdAt"
>;

export type AnalyticsStats = {
  totalPatients: number;
  distribution: AnalyticsDistribution[];
  averages: AnalyticsAverages;
  criticalAlerts: CriticalAlert[];
};

export function useAnalytics() {
  return useQuery<AnalyticsStats>({
    queryKey: ["/api/assessments/analytics"],
  });
}
