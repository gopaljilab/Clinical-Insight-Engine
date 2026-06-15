/**
 * date_fix.ts
 *
 * Thin compatibility shim — re-exports the canonical `parseClinicalDate`
 * from the shared module so existing callers of `safeParseDate` keep working
 * while the underlying logic is now ambiguity-aware.
 *
 * Prefer importing from `@shared/dateParser` directly in new code.
 */

export { parseClinicalDate as safeParseDate } from "@shared/dateParser";
