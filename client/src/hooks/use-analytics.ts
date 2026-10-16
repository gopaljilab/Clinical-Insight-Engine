import { useQuery } from "@tanstack/react-query";
import type { Assessment } from "@shared/schema";
import { ApiClient } from "../lib/apiClient";

export type AnalyticsDistribution = {
  category: "LOW" | "MODERATE" | "HIGH";
  count: number;
};

export type AnalyticsAverages = {
  bmi: number;
  hba1c: number;
  glucose: number;
  riskScore: number;
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
 * React hook for analytics.
 * @param filters - Optional cohort filters to discover population sub-segments
 * @returns The query result containing stats for the matching cohort
 */
export function useAnalytics(filters?: Record<string, any>) {
  return useQuery<AnalyticsStats>({
    queryKey: ["/api/analytics", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, val]) => {
          if (val !== undefined && val !== null && val !== "" && val !== "All") {
            params.append(key, String(val));
          }
        });
      }
      const queryString = params.toString();
      const url = queryString ? `/api/analytics?${queryString}` : "/api/analytics";
      return ApiClient.get<AnalyticsStats>(url);
    }
  });
}
