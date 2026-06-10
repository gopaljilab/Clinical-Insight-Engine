const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

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
    text = JSON.stringify(value);
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

export function escapeCsvCell(value: unknown): string {
  const sanitized = sanitizeCsvCell(value);

  if (/[",\r\n]/.test(sanitized)) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }

  return sanitized;
}
