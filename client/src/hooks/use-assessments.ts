import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AssessmentInput, type AssessmentResponse, type AssessmentsListResponse } from "@shared/routes";

// Parse with logging to catch silent Zod JSON translation errors
function parseWithLogging<T>(schema: any, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

// The base query key for all assessments list queries.
const ASSESSMENTS_LIST_QUERY_KEY = api.assessments.list.path;

export function useAssessments() {
  return useInfiniteQuery({
    queryKey: [ASSESSMENTS_LIST_QUERY_KEY],
    queryFn: async ({ pageParam }) => {
      const url = new URL(api.assessments.list.path, window.location.origin);
      if (pageParam !== undefined) {
        url.searchParams.set("cursor", String(pageParam));
      }
      url.searchParams.set("limit", "50");
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch assessments");
      const data = await res.json();
      return parseWithLogging<AssessmentsListResponse>(api.assessments.list.responses[200], data, "assessments.list");
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/**
 * Hook to search assessments filtered by a patient name.
 *
 * FIX for Issue #744 (Cross-Patient Data Leakage):
 * Each unique `patientName` gets its own React Query cache key:
 *   ["assessments-patient", "<patientName>"]
 *
 * This means switching from Patient A to Patient B will NEVER show Patient A's
 * cached data in Patient B's view — the two patients have separate cache entries.
 *
 * The cache entry is also invalidated whenever a new assessment is created.
 *
 * @param patientName - The exact patient name to filter by. Pass null/undefined
 *   to skip the query entirely (no stale data risk when no patient is selected).
 */
export function usePatientAssessments(patientName: string | null | undefined) {
  return useInfiniteQuery({
    // CRITICAL: Patient name is part of the query key so each patient has
    // an isolated cache entry. This prevents cross-patient data leakage.
    queryKey: ["assessments-patient", patientName ?? ""],
    enabled: Boolean(patientName),
    queryFn: async ({ pageParam }) => {
      const url = new URL("/api/assessments/search", window.location.origin);

      // Filter strictly by patient name on the backend.
      if (patientName) {
        url.searchParams.set("q", patientName);
      }
      if (pageParam !== undefined) {
        url.searchParams.set("cursor", String(pageParam));
      }
      url.searchParams.set("limit", "50");

      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch patient assessments");
      const data = await res.json();

      // Ensure the returned records actually belong to this patient.
      // This is a client-side safety guard in addition to server-side scoping.
      const safeData = {
        ...data,
        data: Array.isArray(data.data)
          ? data.data.filter(
              (a: any) =>
                (a.patientName ?? "").toLowerCase() === (patientName ?? "").toLowerCase()
            )
          : [],
      };

      return safeData as AssessmentsListResponse;
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

/**
 * Utility hook to explicitly clear a patient's cached assessment data.
 * Call this when navigating away from a patient's profile to ensure
 * the next visit always loads fresh data from the server.
 */
export function useClearPatientCache() {
  const queryClient = useQueryClient();
  return (patientName: string | null | undefined) => {
    if (!patientName) return;
    queryClient.removeQueries({
      queryKey: ["assessments-patient", patientName],
    });
  };
}

export function useCreateAssessment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: AssessmentInput) => {
      // Ensure numeric fields are coerced correctly before sending if needed
      const validated = api.assessments.create.input.parse(data);
      
      const res = await fetch(api.assessments.create.path, {
        method: api.assessments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Validation failed");
        }
        throw new Error("Failed to create assessment");
      }
      
      const responseData = await res.json();
      
      // If the backend returns 202, it means the job is queued
      if (res.status === 202 && responseData.jobId) {
        return new Promise<AssessmentResponse>((resolve, reject) => {
          const poll = async () => {
            try {
              const jobRes = await fetch(`/api/assessments/jobs/${responseData.jobId}`, { credentials: "include" });
              if (!jobRes.ok) throw new Error("Failed to check job status");
              const jobData = await jobRes.json();
              
              if (jobData.status === "completed") {
                resolve(parseWithLogging<AssessmentResponse>(api.assessments.create.responses[201], jobData.result, "assessments.create.job"));
              } else if (jobData.status === "failed") {
                reject(new Error(jobData.error || "Job failed"));
              } else {
                // Poll again in 2 seconds
                setTimeout(poll, 2000);
              }
            } catch (err) {
              reject(err);
            }
          };
          // Start polling
          setTimeout(poll, 1000);
        });
      }

      return parseWithLogging<AssessmentResponse>(api.assessments.create.responses[201], responseData, "assessments.create");
    },
    onSuccess: () => {
      // Invalidate both the full list and all per-patient caches so new
      // assessments are reflected immediately without stale data leaking.
      queryClient.invalidateQueries({ queryKey: [ASSESSMENTS_LIST_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["assessments-patient"] });
    },
  });
}
