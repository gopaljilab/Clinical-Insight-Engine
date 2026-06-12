/**
 * access-audit.ts
 *
 * Secure logging for authorization decisions.
 * Ensures that PHI is never written to logs while maintaining an audit trail
 * of object access, particularly denied attempts (IDOR/enumeration).
 */

import { logger } from "../logger";
import { storage } from "../storage";

export interface AuditEvent {
  timestamp: string;
  type: "ACCESS_GRANTED" | "ACCESS_DENIED";
  userId: string;
  resourceType: string;
  resourceId: number | string;
  reason: string;
  authMethod?: "session" | "jwt" | "api_key";
}

/**
 * Logs an object-level access decision to both the structured logger
 * and the persistent patient_access_audit_logs table.
 *
 * @param userId The ID of the authenticated user attempting access
 * @param resourceType The type of resource (e.g. "Assessment", "Patient")
 * @param resourceId The ID of the resource
 * @param granted Whether access was granted
 * @param reason The reason for the decision
 * @param authMethod Optional authentication method used
 * @param req Optional Express request for IP/User-Agent extraction
 */
export function logAccessAttempt(
  userId: string,
  resourceType: string,
  resourceId: number | string,
  granted: boolean,
  reason: string,
  authMethod?: "session" | "jwt" | "api_key",
  req?: Request
): void {
  const timestamp = new Date().toISOString();
  const event: AuditEvent = {
    timestamp,
    type: granted ? "ACCESS_GRANTED" : "ACCESS_DENIED",
    userId,
    resourceType,
    resourceId,
    reason,
  };

  if (authMethod) {
    event.authMethod = authMethod;
  }

  if (granted) {
    logger.info({ audit: event }, "Access Granted");
  } else {
    logger.warn({ audit: event, security: true }, "Access Denied");
  }

  storage.recordPatientAccess({
    userId,
    resourceType,
    resourceId: String(resourceId),
    action: granted ? "VIEW" : "DENIED",
    ipAddress: req?.ip,
    userAgent: req?.headers?.["user-agent"],
    granted,
  }).catch((err) => logger.error({ err }, "Failed to persist access audit log"));
}