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
  commonFactors: { factor: string; count: number }[];
  demographics: {
    gender: { gender: string; riskCategory: string; count: number }[];
    age: { ageGroup: string; riskCategory: string; count: number }[];
  };
};

/**
 * React hook for  analytics.
 * @returns The result of the operation.
 */
export function useAnalytics() {
  return useQuery<AnalyticsStats>({
    queryKey: ["/api/analytics"],
  });
}
