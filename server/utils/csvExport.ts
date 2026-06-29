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
import { escapeCsvCell } from "./csvSanitizer";

export function assessmentsToCsv(data: Record<string, unknown>[]): string {
  if (!data || data.length === 0) return "";

  const headers = Object.keys(data[0]);

  const lines = [
    headers.join(","),
    ...data.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(",")),
  ];

  return lines.join("\n");
}