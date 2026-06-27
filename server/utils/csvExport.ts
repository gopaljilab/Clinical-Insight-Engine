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
  const rows = data.map(row => 
    headers.map(header => {
      const cell = row[header] === null || row[header] === undefined ? '' : String(row[header]);
      return `"${cell.replace(/"/g, '""')}"`;
    }).join(',')
  );
  
  return [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','), ...rows].join('\n');
}