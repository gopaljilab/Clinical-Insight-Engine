export function sanitizeHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}
