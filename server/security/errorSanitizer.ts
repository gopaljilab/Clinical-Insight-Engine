/**
 * errorSanitizer.ts
 *
 * Sanitizes error messages to prevent exposure of sensitive information
 * such as stack traces, file paths, SQL details, and internal system details.
 */

/**
 * Patterns that indicate sensitive information in error messages.
 * These are stripped from client-facing error responses.
 */
const SENSITIVE_PATTERNS = [
  /at\s+\S+\s+\(\S+\/\S+\)/gi, // Stack trace frames (at file path)
  /\/[\w\-./]+\.(ts|js|py|java|rb)/gi, // File paths with extensions
  /\/(?:home|Users|root|var|etc|tmp|app|srv)\/[\w\-./]+/gi, // Absolute system paths
  /C:\\[\w\\]+/gi, // Windows paths
  /(?:database|relation|table|column|schema).*(?:error|failed|missing|does not exist)/gi, // Database error details
  /(?:database|secret|credential|api.?key|token)\s*(?:error|validation|mismatch|failed)/gi, // Credential/auth errors
  /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, // IP addresses
];

/**
 * Messages that should never be exposed to clients.
 * Maps error types to safe messages.
 */
const ERROR_MESSAGE_MAPPING: Record<string, string> = {
  "ENOENT": "Resource not found",
  "EACCES": "Access denied",
  "ETIMEDOUT": "Request timed out",
  "ECONNREFUSED": "Service unavailable",
  "ECONNRESET": "Connection reset",
};

/**
 * Check if an error message contains sensitive information.
 */
function containsSensitiveInfo(message: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Sanitize an error message by removing sensitive information.
 * Returns a safe message suitable for client exposure.
 *
 * @param error The error object or message
 * @param defaultMessage Fallback message if sanitization results in empty string
 * @returns A safe error message for client response
 */
export function sanitizeErrorMessage(
  error: unknown,
  defaultMessage = "An error occurred"
): string {
  if (!error) {
    return defaultMessage;
  }

  // Extract message from Error object
  let message = "";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object" && "message" in error) {
    message = String((error as any).message);
  } else {
    return defaultMessage;
  }

  // Check for known safe error codes
  if ((error as any)?.code && ERROR_MESSAGE_MAPPING[(error as any).code]) {
    return ERROR_MESSAGE_MAPPING[(error as any).code];
  }

  // Return default if message contains sensitive info
  if (containsSensitiveInfo(message)) {
    return defaultMessage;
  }

  // Only return message if it doesn't contain "Error" suffix or system keywords
  if (message.toLowerCase().includes("internal") ||
      message.toLowerCase().includes("system") ||
      message.toLowerCase().includes("uncaught")) {
    return defaultMessage;
  }

  return message || defaultMessage;
}

/**
 * Safe error response wrapper for 5xx errors.
 * Always returns a generic message to the client.
 */
export function getSafeServerErrorMessage(error?: unknown): string {
  return "An internal server error occurred";
}

/**
 * Safe error response wrapper for 4xx validation errors.
 * Returns message only if it doesn't expose sensitive paths or internal details.
 */
export function getSafeClientErrorMessage(
  error: unknown,
  defaultMessage = "Invalid request"
): string {
  return sanitizeErrorMessage(error, defaultMessage);
}
