import { escapeCsvCell } from "./csvSanitizer";

/**
 * Converts assessment records to a CSV string.
 * Rows are joined using the standard newline control character (\n) as the delimiter.
 */
export function assessmentsToCsv(data: Record<string, unknown>[]): string {
  const valid = data.filter(Boolean);
  if (valid.length === 0) return "";
  const headers = Object.keys(valid[0]);
  const rows = valid.map((row) =>
    headers.map((h) => escapeCsvCell(row[h])).join(",")
  );
  return [headers.map(escapeCsvCell).join(","), ...rows].join("\n");
}
