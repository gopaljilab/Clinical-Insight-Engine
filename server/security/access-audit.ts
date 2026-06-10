/**
 * access-audit.ts
 *
 * Secure logging for authorization decisions.
 * Ensures that PHI is never written to logs while maintaining an audit trail
 * of object access, particularly denied attempts (IDOR/enumeration).
 */

import { logger } from "../logger";

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
 * Logs an object-level access decision.
 * 
 * @param userId The ID of the authenticated user attempting access
 * @param resourceType The type of resource (e.g. "Assessment", "Patient")
 * @param resourceId The ID of the resource
 * @param granted Whether access was granted
 * @param reason The reason for the decision
 * @param authMethod Optional authentication method used
 */
export function logAccessAttempt(
  userId: string,
  resourceType: string,
  resourceId: number | string,
  granted: boolean,
  reason: string,
  authMethod?: "session" | "jwt" | "api_key"
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
}
