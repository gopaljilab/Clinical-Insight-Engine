export function safeParseDate(dateStr: string) {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}
