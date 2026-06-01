import { validateFilterInput } from "../validation/filterValidation";

/**
 * Encodes potentially dangerous characters into HTML entities.
 * Ensures the browser strictly treats the input as text, even if somehow
 * placed outside of standard React rendering flow.
 */
export function encodeHtmlEntities(rawStr: string): string {
  return rawStr
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Retrieves a query parameter safely by applying both validation
 * and output encoding.
 */
export function getSafeQueryParam(searchString: string, key: string): string {
  try {
    const params = new URLSearchParams(searchString);
    const rawValue = params.get(key) || "";
    
    // Validate length and malicious patterns
    const validated = validateFilterInput(rawValue);
    
    // HTML Entity encode for safe output
    return encodeHtmlEntities(validated);
  } catch (err) {
    console.error("Failed to parse query params securely", err);
    return "";
  }
}
