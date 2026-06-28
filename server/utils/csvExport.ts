/**
 * Converts an array of assessment records into CSV format.
 *
 * Sanitizes dangerous formula prefixes (=, +, -, @) per OWASP CSV injection
 * guidance, escapes values containing commas, quotes, or newlines per RFC 4180,
 * and flattens nested objects/arrays into human-readable key:value pairs.
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
    headers.map(escapeCsvCell).join(","),
    ...data.map((row) => headers.map((h) => escapeCsvCell(row[h])).join(",")),
  ];

  return lines.join("\n");
}