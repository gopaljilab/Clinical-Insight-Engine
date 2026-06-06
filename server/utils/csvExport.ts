import { escapeCsvCell } from "./csvSanitizer";

export function assessmentsToCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => escapeCsvCell(row[h])).join(",")
  );
  return [headers.map(escapeCsvCell).join(","), ...rows].join("\\n");
}
