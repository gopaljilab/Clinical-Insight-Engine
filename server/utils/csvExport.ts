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
export function assessmentsToCsv(data: any[]): string {
  if (!data || data.length === 0) return "";
  
  const headers = Object.keys(data[0]);
  const rows = data.map(row => {
    return headers.map(header => {
      return escapeCsvCell(row[header]);
    }).join(",");
  });
  
  return [headers.join(","), ...rows].join("\n");
}