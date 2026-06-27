const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

function flattenCellValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => flattenCellValue(item))
      .filter(Boolean)
      .join("; ");
  }
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${flattenCellValue(v)}`)
      .join(", ");
  }
  return String(value ?? "");
}

/**
 * Sanitizes a value before CSV export.
 *
 * Handles null values, arrays, objects, dates, and protects against
 * CSV formula injection attacks by prefixing dangerous values.
 *
 * @param value - The value to sanitize.
 * @returns A safe string representation suitable for CSV output.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number") {
    return String(value);
  }

  let text: string;
  if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === "object") {
    text = flattenCellValue(value);
  } else {
    text = String(value);
  }

  const trimmed = text.trim();
  if (trimmed !== "" && !isNaN(Number(trimmed))) {
    return text;
  }

  if (FORMULA_PREFIX_PATTERN.test(text.trimStart())) {
    text = `'${text}`;
  }

  return text;
}

/**
 * Escapes a CSV cell according to CSV formatting rules.
 *
 * Wraps values containing commas, quotes, or line breaks in quotes
 * and escapes embedded quotation marks.
 *
 * @param value - The value to escape.
 * @returns A properly escaped CSV cell value.
 */
export function escapeCsvCell(value: unknown): string {
  const sanitized = sanitizeCsvCell(value);

  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}