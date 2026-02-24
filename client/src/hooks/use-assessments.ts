import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  return useQuery({
    queryKey: [api.assessments.list.path],
    queryFn: async () => {
      const res = await fetch(api.assessments.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch assessments");
      const data = await res.json();
      return parseWithLogging<AssessmentsListResponse>(api.assessments.list.responses[200], data, "assessments.list");
    },
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
      return parseWithLogging<AssessmentResponse>(api.assessments.create.responses[201], responseData, "assessments.create");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.assessments.list.path] });
    },
  });
}
