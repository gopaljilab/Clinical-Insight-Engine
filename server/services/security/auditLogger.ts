import crypto from "crypto";
import { logger } from "../../logger";

export interface AuditLogDetails {
  requestId: string;
  exceptionType?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  [key: string]: any;
}

/**
 * Masks sensitive payload values like SSN, medical conditions, names, or emails
 * to prevent PII leakage into server logs.
 */
function maskSensitiveData(data: Record<string, any>): Record<string, any> {
  const masked = { ...data };
  const sensitiveKeys = ["ssn", "password", "passwordhash", "email", "fullname", "medicallicensenumber", "patientname"];

  for (const key of Object.keys(masked)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      masked[key] = "***-MASKED-***";
    } else if (typeof masked[key] === "object" && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }
  return masked;
}

/**
 * Logs security audit events internally.
 * This ensures that PHI is never logged unnecessarily.
 */
export function logAuditEvent(message: string, details: AuditLogDetails, error?: unknown): void {
  const timestamp = new Date().toISOString();
  
  const safeDetails = maskSensitiveData(details);

  const logPayload = {
    timestamp,
    message,
    ...safeDetails,
  };

  if (error) {
    if (error instanceof Error) {
      // Only include stack trace in dev/staging if strictly needed,
      // but usually safe internally. Let's format it nicely.
      (logPayload as any).errorName = error.name;
      (logPayload as any).errorMessage = error.message;
      (logPayload as any).stackTrace = error.stack;
    } else {
      (logPayload as any).rawError = String(error);
    }
  }

  // Use stringify to prevent multi-line interleaving in central loggers.
  // Security events logged at warn level so they're visible in production monitoring/alerting.
  logger.warn({ auditLog: logPayload }, "Security Audit Event");
}

/**
 * Generates a unique request ID.
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}
