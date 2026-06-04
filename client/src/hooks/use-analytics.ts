import { useQuery } from "@tanstack/react-query";

export type AnalyticsDistribution = {
  category: "LOW" | "MODERATE" | "HIGH";
  count: number;
};

export type AnalyticsAverages = {
  bmi: number;
  hba1c: number;
};

export type AnalyticsStats = {
  totalPatients: number;
  distribution: AnalyticsDistribution[];
  averages: AnalyticsAverages;
  criticalAlerts: any[]; // The top 5 assessments
};

export function useAnalytics() {
  return useQuery<AnalyticsStats>({
    queryKey: ["/api/assessments/analytics"],
  });
}
