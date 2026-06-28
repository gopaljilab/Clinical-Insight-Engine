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
  if (!data || data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const escapeCsv = (val: unknown): string => {
    const str = val == null ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCsv).join(","),
    ...data.map((row) => headers.map((h) => escapeCsv(row[h])).join(",")),
  ];

  return lines.join("\n");
}