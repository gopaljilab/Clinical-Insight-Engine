import { z } from "zod";
import { insertAssessmentSchema, assessments } from "./schema";

/** Allowed risk category values for search filtering. */
export const RISK_CATEGORIES = ["LOW", "MODERATE", "HIGH"] as const;
export type RiskCategoryFilter = (typeof RISK_CATEGORIES)[number];

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  assessments: {
    create: {
      method: "POST" as const,
      path: "/api/assessments" as const,
      input: insertAssessmentSchema,
      responses: {
        201: z.custom<typeof assessments.$inferSelect>(),
        202: z.object({ jobId: z.string(), message: z.string() }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    list: {
      method: "GET" as const,
      path: "/api/assessments" as const,
      /** Query params: limit, cursor */
      responses: {
        200: z.object({
          data: z.array(z.custom<typeof assessments.$inferSelect>()),
          nextCursor: z.number().nullable().optional(),
          total: z.number(),
          page: z.number(),
          limit: z.number(),
          totalPages: z.number(),
        }),
      },
    },
    search: {
      method: "GET" as const,
      path: "/api/assessments/search" as const,
      /** Query params: q, riskCategory, cursor, limit */
      responses: {
        200: z.object({
          data: z.array(z.custom<typeof assessments.$inferSelect>()),
          nextCursor: z.number().nullable(),
        }),
        400: errorSchemas.validation,
        401: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    getById: {
      method: "GET" as const,
      path: "/api/assessments/:id" as const,
      responses: {
        200: z.custom<typeof assessments.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
        500: errorSchemas.internal,
      },
    },
    preview: {
      method: "POST" as const,
      path: "/api/assessments/preview" as const,
      input: insertAssessmentSchema,
      responses: {
        200: z.object({
          riskScore: z.number(),
          riskCategory: z.string(),
          factors: z.array(
            z.object({
              name: z.string(),
              impact: z.string(),
              description: z.string(),
            })
          ),
          confidenceInterval: z.string().nullable().optional(),
          modelConfidence: z.number().nullable().optional(),
          isFallback: z.boolean().optional(),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    simulate: {
      method: "POST" as const,
      path: "/api/assessments/simulate" as const,
      input: insertAssessmentSchema,
      responses: {
        200: z.object({
          simulatedRisk: z.number(),
          riskCategory: z.enum(["LOW", "MODERATE", "HIGH"]),
          confidence: z.number().nullable().optional(),
          factorContributions: z
            .array(
              z.object({
                name: z.string(),
                impact: z.enum(["positive", "negative"]),
                description: z.string(),
              })
            )
            .optional(),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
    biomarkerAlerts: {
      method: "GET" as const,
      path: "/api/assessments/biomarker-alerts" as const,
      responses: {
        200: z.object({
          alerts: z.array(
            z.object({
              biomarker: z.enum(["HbA1c", "Blood Glucose", "BMI"]),
              trend: z.enum(["increasing", "decreasing", "stable"]),
              severity: z.enum(["warning", "info"]),
              message: z.string(),
              values: z.array(z.object({ ts: z.string().optional(), value: z.number() })),
            })
          ),
        }),
        400: errorSchemas.validation,
        500: errorSchemas.internal,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type AssessmentInput = z.infer<typeof api.assessments.create.input>;
export type PredictionAdvice = {
  clinicianAdvice?: string[];
  patientAdvice?: string[];
};

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  urgency?: "low" | "medium" | "high";
  audience?: "clinician" | "patient" | "both";
  checklist?: boolean;
};

export type AssessmentResponse = z.infer<typeof api.assessments.create.responses[201]> & {
  prediction?: PredictionAdvice & {
    riskScore?: number;
    riskCategory?: string;
    confidenceInterval?: string | null;
    modelConfidence?: number | null;
    disclaimer?: string;
    isFallback?: boolean;
  };
  recommendations?: Recommendation[];
};
export type AssessmentsListResponse = z.infer<typeof api.assessments.list.responses[200]>;
export type AssessmentPreviewResponse = z.infer<typeof api.assessments.preview.responses[200]>;
export type AssessmentSimulationResponse = z.infer<typeof api.assessments.simulate.responses[200]>;
