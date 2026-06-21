type DateInput = string | number | Date | null | undefined;

interface DateFormatOptions {
  fallback?: string;
  includeTime?: boolean;
}

function parseDate(value: DateInput): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format Readable Date.
 * @param value - The value parameter.
 * @param options - The options parameter.
 * @returns The result of the operation.
 */
export function formatReadableDate(value: DateInput, options: DateFormatOptions = {}): string {
  const { fallback = "Unknown date", includeTime = true } = options;
  const date = parseDate(value);
  if (!date) return fallback;

  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  }).format(date);

  return includeTime ? formatted.replace(/, (?=\d{1,2}:)/, " at ") : formatted;
}

/**
 * Format Compact Date.
 * @param value - The value parameter.
 * @param fallback - The fallback parameter.
 * @returns The result of the operation.
 */
export function formatCompactDate(value: DateInput, fallback = "?"): string {
  const date = parseDate(value);
  if (!date) return fallback;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}
