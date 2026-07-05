/**
 * shared/dateParser.ts
 *
 * Robust clinical date parsing utility.
 *
 * PROBLEM SOLVED
 * --------------
 * JavaScript's `new Date("08/10/2022")` and `Date.parse("08/10/2022")` silently
 * interpret slashed dates as MM/DD/YYYY on most runtimes (US locale), but the
 * result is entirely locale-dependent.  In a clinical context, misreading
 * August 10 vs October 8 can alter an entire patient timeline.
 *
 * APPROACH
 * --------
 * 1.  ISO 8601 (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ssZ`) → always accepted with
 *     full confidence.  This is the only format the engine should *store*.
 *
 * 2.  Slashed / dashed ambiguous formats (`MM/DD/YYYY`, `DD/MM/YYYY`,
 *     `DD-MM-YYYY`, etc.) → detected, and:
 *       - If only one interpretation yields a valid calendar date → accepted at
 *         medium confidence (0.7) with a warning.
 *       - If both interpretations yield valid dates → `ambiguous: true`,
 *         `confidence: 0.3`, `date: null`.  The caller must surface a flag /
 *         prompt the user for clarification.
 *
 * 3.  Unrecognised formats → `{ date: null, confidence: 0, ambiguous: false }`.
 *
 * USAGE
 * -----
 * ```ts
 * import { parseClinicalDate } from "@shared/dateParser";
 *
 * const result = parseClinicalDate("08/10/2022");
 * if (!result.date) {
 *   // ambiguous or invalid — surface to user
 * }
 * ```
 */

export interface ClinicalDateParseResult {
  /** Parsed Date object.  `null` when ambiguous or invalid. */
  date: Date | null;
  /**
   * Confidence in the parse, 0–1.
   *   1.0  → unambiguous (ISO 8601 or named-month format)
   *   0.7  → only one numeric interpretation is a valid calendar date
   *   0.3  → both numeric interpretations are valid (truly ambiguous)
   *   0.0  → unrecognised / invalid
   */
  confidence: number;
  /** True when the raw string could represent two different calendar dates. */
  ambiguous: boolean;
  /**
   * ISO 8601 representation of the parsed date, or `null`.
   * Always `YYYY-MM-DD` (date part only).
   */
  isoString: string | null;
  /** Human-readable explanation of why confidence is not 1.0, if applicable. */
  warning?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Zero-pad a number to 2 digits. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Return `YYYY-MM-DD` from a Date, in UTC to avoid timezone drift. */
function toIsoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/**
 * Safely construct a UTC Date from year/month(1-based)/day.
 * Returns null if the values don't form a valid calendar date.
 */
function makeUtcDate(year: number, month: number, day: number): Date | null {
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  // Guard against JS date roll-over (e.g. Feb 30 → Mar 2)
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

/** True if a value could be a DD (1–31). */
const couldBeDay = (n: number) => n >= 1 && n <= 31;
/** True if a value could be a MM (1–12). */
const couldBeMonth = (n: number) => n >= 1 && n <= 12;

// ---------------------------------------------------------------------------
// ISO 8601 pattern  YYYY-MM-DD  or  YYYY-MM-DDTHH:mm:ss[.mmm]Z
// ---------------------------------------------------------------------------
const ISO_DATE_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:T[\d:]+(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

// ---------------------------------------------------------------------------
// Ambiguous slashed / dashed  A/B/YYYY  or  A-B-YYYY  (where A,B ≤ 2 digits)
// ---------------------------------------------------------------------------
const AMBIGUOUS_DMY_MDY_RE = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;

// ---------------------------------------------------------------------------
// Unambiguous  YYYY/MM/DD  (large-endian with slashes)
// ---------------------------------------------------------------------------
const YYYY_SLASH_RE = /^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/;

// ---------------------------------------------------------------------------
// Named-month patterns:  "10 Aug 2022", "Aug 10, 2022", "10th August 2022"
// ---------------------------------------------------------------------------
const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const NAMED_MONTH_RE =
  /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$|^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/;

function tryParseNamedMonth(raw: string): Date | null {
  const m = raw.trim().match(NAMED_MONTH_RE);
  if (!m) return null;

  let day: number, monthName: string, year: number;

  if (m[1] !== undefined) {
    // "10 Aug 2022" form
    day = parseInt(m[1], 10);
    monthName = m[2].toLowerCase();
    year = parseInt(m[3], 10);
  } else {
    // "Aug 10, 2022" form
    monthName = m[4].toLowerCase();
    day = parseInt(m[5], 10);
    year = parseInt(m[6], 10);
  }

  const month = MONTH_NAMES[monthName];
  if (!month) return null;
  return makeUtcDate(year, month, day);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a raw date string from a clinical note or user input.
 *
 * @param raw - The raw date string, e.g. "08/10/2022", "2022-08-10", "10 Aug 2022"
 * @returns A `ClinicalDateParseResult` with confidence and ambiguity metadata.
 */
export function parseClinicalDate(raw: string): ClinicalDateParseResult {
  const trimmed = raw.trim();

  // ── 1. ISO 8601 ────────────────────────────────────────────────────────────
  const isoMatch = trimmed.match(ISO_DATE_RE);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const date = makeUtcDate(year, month, day);
    if (date) {
      return { date, confidence: 1.0, ambiguous: false, isoString: toIsoDate(date) };
    }
    // Values parsed but don't form a real date (e.g. 2022-13-45)
    return { date: null, confidence: 0, ambiguous: false, isoString: null,
      warning: `"${trimmed}" looks like ISO 8601 but contains an invalid calendar date.` };
  }

  // ── 2. Large-endian YYYY/MM/DD or YYYY-MM-DD (already caught above) ───────
  const yyyySlashMatch = trimmed.match(YYYY_SLASH_RE);
  if (yyyySlashMatch) {
    const year = parseInt(yyyySlashMatch[1], 10);
    const month = parseInt(yyyySlashMatch[2], 10);
    const day = parseInt(yyyySlashMatch[3], 10);
    const date = makeUtcDate(year, month, day);
    if (date) {
      return { date, confidence: 1.0, ambiguous: false, isoString: toIsoDate(date) };
    }
    return { date: null, confidence: 0, ambiguous: false, isoString: null,
      warning: `"${trimmed}" has an invalid calendar date.` };
  }

  // ── 3. Named-month (unambiguous) ───────────────────────────────────────────
  const namedDate = tryParseNamedMonth(trimmed);
  if (namedDate) {
    return { date: namedDate, confidence: 1.0, ambiguous: false, isoString: toIsoDate(namedDate) };
  }

  // ── 4. Ambiguous  A/B/YYYY  or  A-B-YYYY ──────────────────────────────────
  const ambigMatch = trimmed.match(AMBIGUOUS_DMY_MDY_RE);
  if (ambigMatch) {
    const a = parseInt(ambigMatch[1], 10);  // could be DD or MM
    const b = parseInt(ambigMatch[2], 10);  // could be MM or DD
    const year = parseInt(ambigMatch[3], 10);

    // Interpretation 1: MM/DD/YYYY  (US)
    const asUS = couldBeMonth(a) ? makeUtcDate(year, a, b) : null;
    // Interpretation 2: DD/MM/YYYY  (UK / ISO-like)
    const asUK = couldBeMonth(b) ? makeUtcDate(year, b, a) : null;

    const usValid = asUS !== null;
    const ukValid = asUK !== null;

    if (usValid && ukValid && toIsoDate(asUS!) !== toIsoDate(asUK!)) {
      // Truly ambiguous — both interpretations are valid AND differ
      return {
        date: null,
        confidence: 0.3,
        ambiguous: true,
        isoString: null,
        warning:
          `"${trimmed}" is ambiguous: could be ${toIsoDate(asUS!)} (MM/DD/YYYY) ` +
          `or ${toIsoDate(asUK!)} (DD/MM/YYYY). ` +
          `Please reformat to ISO 8601 (YYYY-MM-DD).`,
      };
    }

    if (usValid && !ukValid) {
      return {
        date: asUS,
        confidence: 0.7,
        ambiguous: false,
        isoString: toIsoDate(asUS!),
        warning:
          `"${trimmed}" was interpreted as MM/DD/YYYY → ${toIsoDate(asUS!)}. ` +
          `Use ISO 8601 (YYYY-MM-DD) to avoid ambiguity.`,
      };
    }

    if (ukValid && !usValid) {
      return {
        date: asUK,
        confidence: 0.7,
        ambiguous: false,
        isoString: toIsoDate(asUK!),
        warning:
          `"${trimmed}" was interpreted as DD/MM/YYYY → ${toIsoDate(asUK!)}. ` +
          `Use ISO 8601 (YYYY-MM-DD) to avoid ambiguity.`,
      };
    }

    // Neither interpretation valid
    return {
      date: null,
      confidence: 0,
      ambiguous: false,
      isoString: null,
      warning: `"${trimmed}" could not be parsed as a valid date.`,
    };
  }

  // ── 5. Unrecognised format ─────────────────────────────────────────────────
  return {
    date: null,
    confidence: 0,
    ambiguous: false,
    isoString: null,
    warning: `"${trimmed}" is not a recognised date format. Use YYYY-MM-DD (ISO 8601).`,
  };
}

/**
 * Extract all date strings from free-form clinical text and parse each one.
 *
 * Scans for:
 *   - ISO 8601 dates      `YYYY-MM-DD`
 *   - Slashed dates       `DD/MM/YYYY`, `MM/DD/YYYY`
 *   - Named-month dates   `10 Aug 2022`, `August 10, 2022`
 *
 * @param text - Raw clinical note text
 * @returns Array of parse results, each including the original matched string
 *          and its position in the source text.
 */
export interface ExtractedDate extends ClinicalDateParseResult {
  /** The raw date string as it appeared in the source text. */
  rawMatch: string;
  /** Character offset of the match within the source text. */
  offset: number;
}

const DATE_SCAN_RE =
  /\b(\d{4}-\d{2}-\d{2}(?:T[\d:.Z+-]+)?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\s+\d{4}|[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/g;

export function extractDatesFromText(text: string): ExtractedDate[] {
  const results: ExtractedDate[] = [];
  let match: RegExpExecArray | null;
  DATE_SCAN_RE.lastIndex = 0;

  while ((match = DATE_SCAN_RE.exec(text)) !== null) {
    const rawMatch = match[1];
    const parsed = parseClinicalDate(rawMatch);
    results.push({ ...parsed, rawMatch, offset: match.index });
  }

  return results;
}
