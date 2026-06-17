/**
 * searchValidation.ts
 *
 * Input validation for patient/assessment search endpoints.
 *
 * Security note: Validation here is a SUPPLEMENTARY defence-in-depth measure.
 * The PRIMARY security control is parameterized queries via Drizzle ORM.
 * This layer rejects obviously malicious inputs early and logs suspicious patterns.
 */

import { z } from "zod";
import { parseClinicalDate } from "@shared/dateParser";

/**
 * Strict ISO 8601 date validator for query parameters.
 * Rejects ambiguous formats such as MM/DD/YYYY or DD/MM/YYYY and returns
 * a human-readable error directing callers to use YYYY-MM-DD.
 */
function isIso8601Date(val: string | undefined): boolean {
  if (!val) return true;
  const result = parseClinicalDate(val);
  // Only accept with full confidence (1.0) — i.e. unambiguous ISO-like input
  return result.confidence === 1.0 && result.date !== null;
}

/** Maximum characters allowed in a search query string. */
const MAX_SEARCH_LENGTH = 200;

/**
 * SQL injection signature patterns used for early rejection and security logging.
 * These are heuristic — they supplement, not replace, parameterized queries.
 */
const SQL_INJECTION_PATTERNS: RegExp[] = [
  /(\bOR\b|\bAND\b)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i,   // OR 1=1, AND '1'='1'
  /'\s*(OR|AND)\s*'/i,                                           // ' OR '
  /UNION\s+(ALL\s+)?SELECT/i,                                    // UNION SELECT
  /;\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE)\b/i,    // ; DROP TABLE ...
  /--+/,                                                         // SQL line comment: -- or trailing -- space
  /\/\*.*\*\//s,                                                 // /* block comment */
  /\bEXEC\s*\(/i,                                               // EXEC(
  /\bxp_\w+/i,                                                  // xp_ stored procs
  /\bINFORMATION_SCHEMA\b/i,                                    // schema enumeration
  /\bSYS\.(TABLES|COLUMNS|OBJECTS)\b/i,                         // sys tables
  /SLEEP\s*\(\s*\d+\s*\)/i,                                     // time-based: SLEEP(n)
  /WAITFOR\s+DELAY/i,                                           // MSSQL time-based
  /BENCHMARK\s*\(/i,                                             // MySQL time-based
  /LOAD_FILE\s*\(/i,                                             // MySQL file read
  /INTO\s+OUTFILE/i,                                             // MySQL file write
];

/**
 * Characters allowed in a medical search query.
 * Covers: alphanumeric, spaces, hyphens, apostrophes (O'Brien), periods, commas.
 */
const ALLOWED_SEARCH_CHARS_PATTERN = /^[a-zA-Z0-9 \-'.,']+$/;

/**
 * Allowed risk category values.
 */
export const VALID_RISK_CATEGORIES = ["LOW", "MODERATE", "HIGH"] as const;
export type RiskCategory = (typeof VALID_RISK_CATEGORIES)[number];

/**
 * Checks whether a string contains patterns that resemble SQL injection attempts.
 * Returns the first matched pattern description, or null if none found.
 */
export function detectSqlInjectionPattern(input: string): string | null {
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return pattern.toString();
    }
  }
  return null;
}

/**
 * Zod schema for the `GET /api/assessments/search` query parameters.
 *
 * Validates:
 * - `q`            Search term (max 200 chars, safe character set)
 * - `riskCategory` Optional risk filter (LOW | MODERATE | HIGH)
 * - `page`         Pagination page, ≥1 (default 1)
 * - `limit`        Results per page, 1–100 (default 20)
 */
export const searchQuerySchema = z.object({
  q: z
    .string()
    .max(MAX_SEARCH_LENGTH, `Search query must not exceed ${MAX_SEARCH_LENGTH} characters`)
    .optional()
    .transform((val) => (val === undefined ? "" : val.trim()))
    .refine(
      (val) => val === "" || ALLOWED_SEARCH_CHARS_PATTERN.test(val),
      {
        message:
          "Search query contains invalid characters. Only letters, numbers, spaces, hyphens, apostrophes, and periods are allowed.",
      }
    )
    .refine(
      (val) => {
        if (val === "") return true;
        return detectSqlInjectionPattern(val) === null;
      },
      {
        message: "Search query contains a disallowed pattern.",
      }
    ),

  riskCategory: z
    .enum(VALID_RISK_CATEGORIES, {
      errorMap: () => ({
        message: `Risk category must be one of: ${VALID_RISK_CATEGORIES.join(", ")}`,
      }),
    })
    .optional(),

  cursor: z.coerce
    .number()
    .int("Cursor must be an integer")
    .min(1, "Cursor must be at least 1")
    .optional(),

  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must not exceed 100")
    .default(20),
});

export type SearchQueryParams = z.infer<typeof searchQuerySchema>;

export const assessmentsQuerySchema = z.object({
  cursor: z.coerce
    .number()
    .int("Cursor must be an integer")
    .optional(),

  page: z.coerce
    .number()
    .int("Page must be an integer")
    .min(1, "Page must be at least 1")
    .default(1),

  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must not exceed 100")
    .default(50),

  sortBy: z
    .enum(["createdAt", "date", "riskScore", "risk", "age", "bmi", "patientName", "gender"])
    .optional()
    .default("createdAt"),

  order: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc"),

  searchTerm: z
    .string()
    .max(MAX_SEARCH_LENGTH, `Search query must not exceed ${MAX_SEARCH_LENGTH} characters`)
    .optional()
    .transform((val) => (val === undefined ? "" : val.trim()))
    .refine(
      (val) => val === "" || ALLOWED_SEARCH_CHARS_PATTERN.test(val),
      {
        message:
          "Search query contains invalid characters. Only letters, numbers, spaces, hyphens, apostrophes, and periods are allowed.",
      }
    )
    .refine(
      (val) => {
        if (val === "") return true;
        return detectSqlInjectionPattern(val) === null;
      },
      {
        message: "Search query contains a disallowed pattern.",
      }
    ),

  riskCategory: z
    .string()
    .optional()
    .transform((val) => val ? val.trim().toUpperCase() : undefined)
    .refine((val) => !val || ["LOW", "MODERATE", "HIGH", "ALL"].includes(val), {
      message: "Invalid risk category",
    }),

  gender: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return undefined;
      const normalized = val.trim().toLowerCase();
      if (normalized === "male") return "Male";
      if (normalized === "female") return "Female";
      if (normalized === "other") return "Other";
      if (normalized === "all") return "All";
      return val;
    })
    .refine((val) => !val || ["Male", "Female", "Other", "All"].includes(val), {
      message: "Invalid gender value",
    }),

  minAge: z.coerce
    .number()
    .int()
    .min(0)
    .max(120)
    .optional(),

  maxAge: z.coerce
    .number()
    .int()
    .min(0)
    .max(120)
    .optional(),

  startDate: z
    .string()
    .optional()
    .refine(isIso8601Date, {
      message:
        "startDate must be in ISO 8601 format (YYYY-MM-DD). " +
        "Ambiguous formats such as MM/DD/YYYY are not accepted.",
    }),

  endDate: z
    .string()
    .optional()
    .refine(isIso8601Date, {
      message:
        "endDate must be in ISO 8601 format (YYYY-MM-DD). " +
        "Ambiguous formats such as MM/DD/YYYY are not accepted.",
    }),
});

export type AssessmentsQueryParams = z.infer<typeof assessmentsQuerySchema>;

export const assessmentExportQuerySchema = assessmentsQuerySchema.extend({
  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(1000, "Limit must not exceed 1000")
    .default(1000),
});

export type AssessmentExportQueryParams = z.infer<typeof assessmentExportQuerySchema>;

export const cohortQuerySchema = z.object({
  minAge: z.coerce.number().int().min(0).max(120).optional(),
  maxAge: z.coerce.number().int().min(0).max(120).optional(),
  minBmi: z.coerce.number().min(10).max(80).optional(),
  maxBmi: z.coerce.number().min(10).max(80).optional(),
  minHba1c: z.coerce.number().min(3).max(20).optional(),
  maxHba1c: z.coerce.number().min(3).max(20).optional(),
  minGlucose: z.coerce.number().min(30).max(600).optional(),
  maxGlucose: z.coerce.number().min(30).max(600).optional(),
  gender: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const n = val.trim().toLowerCase();
    if (n === "male") return "Male";
    if (n === "female") return "Female";
    if (n === "other") return "Other";
    if (n === "all") return undefined;
    return undefined;
  }).optional(),
  smokingHistory: z.enum(["Never", "Former", "Current"]).optional(),
  hypertension: z.coerce.boolean().optional(),
  heartDisease: z.coerce.boolean().optional(),
  riskCategory: z.string().optional().transform((val) => val ? val.trim().toUpperCase() : undefined)
    .refine((val) => !val || ["LOW", "MODERATE", "HIGH"].includes(val), { message: "Invalid risk category" }),
  startDate: z.string().optional().refine(isIso8601Date, { message: "startDate must be ISO 8601 (YYYY-MM-DD)" }),
  endDate: z.string().optional().refine(isIso8601Date, { message: "endDate must be ISO 8601 (YYYY-MM-DD)" }),
});

export type CohortQueryParams = z.infer<typeof cohortQuerySchema>;
