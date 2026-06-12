/**
 * filterValidation.ts
 *
 * Client-side input validation for search and filter fields.
 *
 * Security layering:
 * - PRIMARY defence: Drizzle ORM parameterized queries on the backend.
 * - SECONDARY defence: Zod schema + SQL pattern detection on the backend (searchValidation.ts).
 * - TERTIARY defence (this file): early client-side rejection of obviously malicious
 *   inputs BEFORE they are sent to the server, providing a faster feedback loop
 *   and reducing the attack surface exposed to the backend.
 *
 * Note: client-side validation is NOT a substitute for server-side validation.
 * A determined attacker can bypass the browser. The server MUST validate independently.
 */

/** Maximum characters allowed in a patient/assessment search query. */
const MAX_SEARCH_LENGTH = 200;

/**
 * XSS (Cross-Site Scripting) patterns — reject HTML/JS injection attempts.
 */
const XSS_PATTERNS: RegExp[] = [
  /<script/gi,
  /javascript:/gi,
  /onerror\s*=/gi,
  /onload\s*=/gi,
  /eval\(/gi,
  /setTimeout\(/gi,
  /setInterval\(/gi,
  /<iframe/gi,
  /<svg/gi,
  /<img/gi,
];

/**
 * SQL injection signature patterns — mirrors the patterns in the backend
 * searchValidation.ts so that payloads like `' OR 1=1 --` are rejected
 * at the client layer BEFORE being sent to the server.
 *
 * Fix for Issue #743: the client previously had NO SQL injection detection,
 * allowing these payloads to pass through filterValidation unchecked.
 */
const SQL_INJECTION_PATTERNS: RegExp[] = [
  /(\bOR\b|\bAND\b)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/i, // OR 1=1, AND '1'='1'
  /'\s*(OR|AND)\s*'/i,                                        // ' OR '
  /\bOR\b\s+['"]?[^\s]+['"]?\s*=\s*['"]?[^\s]+['"]?/i,     // OR 'x'='x'
  /UNION\s+(ALL\s+)?SELECT/i,                                 // UNION SELECT
  /;\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE|TRUNCATE)\b/i, // ; DROP TABLE
  /--+/,                                                      // SQL line comment (-- or ---)
  /\/\*.*\*\//s,                                              // /* block comment */
  /\bEXEC\s*\(/i,                                             // EXEC(
  /\bxp_\w+/i,                                               // xp_ stored procedures
  /\bINFORMATION_SCHEMA\b/i,                                  // schema enumeration
  /\bSYS\.(TABLES|COLUMNS|OBJECTS)\b/i,                      // sys tables
  /SLEEP\s*\(\s*\d+\s*\)/i,                                  // time-based: SLEEP(n)
  /WAITFOR\s+DELAY/i,                                         // MSSQL time-based
  /BENCHMARK\s*\(/i,                                          // MySQL time-based
  /LOAD_FILE\s*\(/i,                                          // MySQL file read
  /INTO\s+OUTFILE/i,                                          // MySQL file write
  /\bSELECT\b.*\bFROM\b/i,                                   // SELECT ... FROM
  /\bINSERT\b.*\bINTO\b/i,                                   // INSERT INTO
  /\bDELETE\b.*\bFROM\b/i,                                   // DELETE FROM
  /\bDROP\b.*\bTABLE\b/i,                                    // DROP TABLE
];

/**
 * Characters allowed in a patient/assessment search query.
 * Covers: letters, numbers, spaces, hyphens, apostrophes (O'Brien), periods, commas.
 * NOTE: apostrophe (') is allowed for names like "O'Brien" but SQL injection
 * patterns above will still catch `' OR 1=1` style payloads.
 */
const ALLOWED_SEARCH_CHARS = /^[a-zA-Z0-9 \-'.,]+$/;

/**
 * Checks whether an input string contains SQL injection patterns.
 * Returns the matched pattern description, or null if none found.
 */
export function detectClientSqlInjection(input: string): string | null {
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return pattern.toString();
    }
  }
  return null;
}

/**
 * Validates a generic filter input string (XSS focus).
 * Sanitizes length and rejects HTML/JS injection patterns.
 *
 * For search fields that may reach the database, prefer `validateSearchInput`.
 */
export function validateFilterInput(input: string | null | undefined): string {
  if (!input) return "";

  // 1. Max length constraint
  let safeInput = input.trim();
  if (safeInput.length > MAX_SEARCH_LENGTH) {
    safeInput = safeInput.substring(0, MAX_SEARCH_LENGTH);
  }

  // 2. Reject XSS payloads
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(safeInput)) {
      return "";
    }
  }

  return safeInput;
}

/**
 * Validates a patient/assessment search term.
 *
 * Applies all checks from `validateFilterInput` PLUS:
 * - SQL injection pattern detection (Fix for Issue #743)
 * - Strict character allowlist
 *
 * Returns the trimmed, safe input string, or an empty string if the input
 * contains any dangerous pattern.
 *
 * @param input - The raw string from the search field.
 * @param onRejected - Optional callback called when the input is rejected,
 *   useful for showing a UI warning to the user.
 */
export function validateSearchInput(
  input: string | null | undefined,
  onRejected?: (reason: string) => void
): string {
  if (!input) return "";

  let safeInput = input.trim();

  // 1. Length constraint
  if (safeInput.length > MAX_SEARCH_LENGTH) {
    safeInput = safeInput.substring(0, MAX_SEARCH_LENGTH);
  }

  // 2. Reject XSS payloads
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(safeInput)) {
onRejected?.("Invalid characters detected in search query.");
      return "";
    }
  }

  // 3. Reject SQL injection patterns (Fix for Issue #743)
  const sqlMatch = detectClientSqlInjection(safeInput);
  if (sqlMatch !== null) {
onRejected?.("Search query contains a disallowed pattern.");
    return "";
  }

  // 4. Strict character allowlist — only permit characters valid in patient names
  //    and clinical terms. This catches any novel injection vector not covered above.
  if (safeInput !== "" && !ALLOWED_SEARCH_CHARS.test(safeInput)) {
onRejected?.("Search query contains invalid characters.");
    return "";
  }

  return safeInput;
}
