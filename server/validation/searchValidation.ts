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
  /--\s*$/m,                                                     // -- comment
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
    .optional(),

  limit: z.coerce
    .number()
    .int("Limit must be an integer")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must not exceed 100")
    .default(20),
});

export type SearchQueryParams = z.infer<typeof searchQuerySchema>;
