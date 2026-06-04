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

export function useAssessments(limit: number = 50, cursor?: number) {
  return useQuery({
    queryKey: [api.assessments.list.path, limit, cursor],
    queryFn: async () => {
      const url = new URL(api.assessments.list.path, window.location.origin);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("limit", limit.toString());
      if (cursor !== undefined) {
        url.searchParams.set("cursor", cursor.toString());
      }
      
      const res = await fetch(url.toString(), { credentials: "include" });
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
        const contentType = res.headers.get("content-type") || "";

        let serverPayload: any = null;
        try {
          serverPayload = contentType.includes("application/json")
            ? await res.json()
            : { raw: await res.text() };
        } catch {
          try {
            serverPayload = { raw: await res.text() };
          } catch {
            serverPayload = null;
          }
        }

        console.error("[useCreateAssessment] Request failed", {
          url: api.assessments.create.path,
          status: res.status,
          payload: serverPayload,
        });

        const message =
          serverPayload?.message ||
          serverPayload?.error ||
          (typeof serverPayload?.raw === "string" ? serverPayload.raw : undefined) ||
          `Failed to create assessment (HTTP ${res.status})`;

        throw new Error(message);
      }
      
      const responseData = await res.json();
      return parseWithLogging<AssessmentResponse>(api.assessments.create.responses[201], responseData, "assessments.create");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.assessments.list.path] });
    },
  });
}
