/**
 * Validates search and filter parameters to prevent malicious inputs.
 */

const MALICIOUS_PATTERNS = [
  /<script/gi,
  /javascript:/gi,
  /onerror\s*=/gi,
  /onload\s*=/gi,
  /eval\(/gi,
  /setTimeout\(/gi,
  /setInterval\(/gi,
  /<iframe/gi,
  /<svg/gi,
  /<img/gi,
];

export function validateFilterInput(input: string | null | undefined): string {
  if (!input) return "";

  // 1. Max length constraint
  let safeInput = input.trim();
  if (safeInput.length > 200) {
    safeInput = safeInput.substring(0, 200);
  }

  // 2. Reject clearly malicious payloads
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(safeInput)) {
      console.warn("Rejected suspicious input payload");
      return "";
    }
  }

  return safeInput;
}
