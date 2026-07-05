import { z } from "zod";
import { api } from "@shared/routes";
import { ApiClient } from "./apiClient";

type ApiRoutes = typeof api;

export type ExtractInput<T> = T extends { input: z.ZodType<infer U> } ? U : undefined;
export type ExtractOutput<T> = T extends { responses: { 200: z.ZodType<infer U> } }
  ? U
  : T extends { responses: { 201: z.ZodType<infer U> } }
  ? U
  : T extends { responses: { 202: z.ZodType<infer U> } }
  ? U
  : unknown;

/**
 * A strictly typed wrapper around ApiClient that guarantees synchronization
 * with the backend drizzle-zod schemas.
 */
export const TypedApiClient = {
  assessments: {
    create: (data: ExtractInput<ApiRoutes["assessments"]["create"]>) =>
      ApiClient.post<ExtractOutput<ApiRoutes["assessments"]["create"]>>(api.assessments.create.path, data),

    list: (params?: Record<string, string | number | undefined | null>) => {
      const url = new URL(api.assessments.list.path, window.location.origin);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
          }
        });
      }
      return ApiClient.get<ExtractOutput<ApiRoutes["assessments"]["list"]>>(url.toString().replace(window.location.origin, ""));
    },

    search: (params?: Record<string, string | number | undefined | null>) => {
      const url = new URL(api.assessments.search.path, window.location.origin);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            url.searchParams.set(key, String(value));
          }
        });
      }
      return ApiClient.get<ExtractOutput<ApiRoutes["assessments"]["search"]>>(url.toString().replace(window.location.origin, ""));
    },

    getById: (id: string | number) => {
      const path = api.assessments.getById.path.replace(":id", String(id));
      return ApiClient.get<ExtractOutput<ApiRoutes["assessments"]["getById"]>>(path);
    },

    preview: (data: ExtractInput<ApiRoutes["assessments"]["preview"]>) =>
      ApiClient.post<ExtractOutput<ApiRoutes["assessments"]["preview"]>>(api.assessments.preview.path, data),

    simulate: (data: ExtractInput<ApiRoutes["assessments"]["simulate"]>) =>
      ApiClient.post<ExtractOutput<ApiRoutes["assessments"]["simulate"]>>(api.assessments.simulate.path, data),

    whatIf: (data: ExtractInput<ApiRoutes["assessments"]["whatIf"]>) =>
      ApiClient.post<ExtractOutput<ApiRoutes["assessments"]["whatIf"]>>(api.assessments.whatIf.path, data),

    whatIfBatch: (data: ExtractInput<ApiRoutes["assessments"]["whatIfBatch"]>) =>
      ApiClient.post<ExtractOutput<ApiRoutes["assessments"]["whatIfBatch"]>>(api.assessments.whatIfBatch.path, data),

    biomarkerAlerts: () =>
      ApiClient.get<ExtractOutput<ApiRoutes["assessments"]["biomarkerAlerts"]>>(api.assessments.biomarkerAlerts.path),

    cohort: {
      query: () =>
        ApiClient.get<ExtractOutput<ApiRoutes["assessments"]["cohort"]["query"]>>(api.assessments.cohort.query.path),
    },
  },
};
