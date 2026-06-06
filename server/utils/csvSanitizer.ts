const FORMULA_PREFIX_PATTERN = /^[=+\-@]/;

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let text = value instanceof Date ? value.toISOString() : String(value);

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
