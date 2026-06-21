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
 * Sanitize Csv Cell.
 * @param value - The value parameter.
 * @returns The result of the operation.
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

  // If the text can be parsed as a valid number, do not prepend a quote
  // This avoids converting negative numbers (e.g. -12.5) or standard integer fields to strings.
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
 * Escape Csv Cell.
 * @param value - The value parameter.
 * @returns The result of the operation.
 */
export function escapeCsvCell(value: unknown): string {
  const sanitized = sanitizeCsvCell(value);

  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}
