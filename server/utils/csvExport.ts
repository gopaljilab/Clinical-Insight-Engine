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
  if (!Array.isArray(data) || data.length === 0) {
    return "";
  }

  // Collect all unique keys across all records to build the header row
  const keys = Object.keys(data[0]);

  const header = keys.join(",");

  const rows = data.map((record) =>
    keys.map((key) => escapeCsvCell(record[key])).join(",")
  );

  return [header, ...rows].join("\n");
}