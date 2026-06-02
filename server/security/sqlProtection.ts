/**
 * sqlProtection.ts
 *
 * Security utilities for SQL injection detection and structured security event logging.
 *
 * Design intent:
 * - Parameterized queries via Drizzle ORM are the PRIMARY defence against SQL injection.
 * - This module provides SUPPLEMENTARY detection and audit logging.
 * - Never log sensitive patient data (PHI) or raw query content.
 */

import type { Request } from "express";
import { detectSqlInjectionPattern } from "../validation/searchValidation";

/** Security event types for structured logging. */
export type SecurityEventType =
  | "SQL_INJECTION_ATTEMPT"
  | "MALFORMED_SEARCH_QUERY"
  | "SUSPICIOUS_SEARCH_PATTERN"
  | "RATE_LIMIT_EXCEEDED"
  | "UNAUTHORIZED_SEARCH_ACCESS";

/** Structured security log entry (no PHI). */
export interface SecurityEvent {
  timestamp: string;
  type: SecurityEventType;
  ip: string;
  userAgent: string;
  path: string;
  method: string;
  /** A short, sanitized description — never the raw malicious input verbatim. */
  detail: string;
  /** Optional: matched pattern description for injection attempts. */
  matchedPattern?: string;
  /** Authenticated user ID (hashed/opaque), if available. */
  userId?: string;
}

/**
 * Emits a structured security event to the console (and optionally a SIEM/log aggregator).
 *
 * PHI safety: never include patient names, record IDs, or search terms in the log.
 */
export function logSecurityEvent(
  type: SecurityEventType,
  detail: string,
  req: Request,
  extra?: { matchedPattern?: string; userId?: string }
): void {
  const event: SecurityEvent = {
    timestamp: new Date().toISOString(),
    type,
    ip: (req.headers["x-forwarded-for"] as string) ?? req.ip ?? "unknown",
    userAgent: (req.headers["user-agent"] as string) ?? "unknown",
    path: req.path,
    method: req.method,
    detail,
    ...extra,
  };

  // Emit as structured JSON so log aggregators (Splunk, Datadog, ELK) can parse it.
  console.warn(`[SECURITY] ${JSON.stringify(event)}`);
}

/**
 * Analyses a raw string input from a user-facing search field for injection signatures.
 *
 * Returns `{ safe: true }` when the input looks benign.
 * Returns `{ safe: false, pattern }` with the matched pattern description when suspicious.
 *
 * NOTE: This does NOT prevent injection on its own — it is a logging/early-rejection aid.
 * The actual protection is Drizzle ORM's parameterized queries.
 */
export function analyzeSearchInput(
  input: string
): { safe: true } | { safe: false; pattern: string } {
  const matched = detectSqlInjectionPattern(input);
  if (matched !== null) {
    return { safe: false, pattern: matched };
  }
  return { safe: true };
}

/**
 * Sanitizes a database error so internal details are never exposed to the client.
 *
 * Maps PostgreSQL error codes to generic user-facing messages.
 * All unrecognised errors become "An unexpected error occurred."
 */
export function sanitizeDatabaseError(error: unknown): {
  statusCode: number;
  message: string;
} {
  if (error && typeof error === "object" && "code" in error) {
    const pgError = error as { code: string; message?: string };

    // PostgreSQL error codes reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
    switch (pgError.code) {
      case "23505": // unique_violation
        return { statusCode: 409, message: "A record with this information already exists." };
      case "23503": // foreign_key_violation
        return { statusCode: 400, message: "Invalid reference in the submitted data." };
      case "23502": // not_null_violation
        return { statusCode: 400, message: "A required field is missing." };
      case "22P02": // invalid_text_representation
        return { statusCode: 400, message: "Invalid data format." };
      case "42P01": // undefined_table
      case "42703": // undefined_column
      case "42601": // syntax_error
        // These should never reach clients — log and return generic message
        console.error("[SECURITY] Database schema error leaked to handler:", pgError.code);
        return { statusCode: 500, message: "An unexpected error occurred." };
      default:
        return { statusCode: 500, message: "An unexpected error occurred." };
    }
  }

  return { statusCode: 500, message: "An unexpected error occurred." };
}
