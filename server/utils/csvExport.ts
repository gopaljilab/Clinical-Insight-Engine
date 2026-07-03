import { escapeCsvCell } from "./csvSanitizer";

/**
 * Converts an array of assessment records into CSV format.
 *
 * @param data - Array of assessment records to export.
 * @returns A CSV-formatted string. Returns an empty string when no valid records are provided.
 *
 * @example
 * assessmentsToCsv([
 *   { name: "John", age: 45 },
 *   { name: "Jane", age: 38 }
 * ]);
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
