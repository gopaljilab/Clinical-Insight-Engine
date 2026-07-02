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
export function assessmentsToCsv(data: Record<string, any>[]): string {
  if (!data || data.length === 0) return "";
  
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(header => escapeCsvCell(row[header])).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
}
