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

export function useAssessments() {
  return useInfiniteQuery({
    queryKey: [api.assessments.list.path],
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
      queryClient.invalidateQueries({ queryKey: [api.assessments.list.path] });
    },
  });
}
