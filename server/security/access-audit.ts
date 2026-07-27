/**
 * access-audit.ts
 *
 * Secure logging for authorization decisions.
 * Ensures that PHI is never written to logs while maintaining an audit trail
 * of object access, particularly denied attempts (IDOR/enumeration).
 *
 * HIPAA Compliance: Logs all PHI access for compliance auditing with required fields:
 * - User identity, timestamp, resource accessed, access result
 * - IP address, user agent for session traceability
 * - Purpose/reason for access (required for compliance)
 * - Session ID for audit trail reconstruction
 */

import { logger } from "../logger";
import { storage } from "../storage";
import type { Request } from "express";

export interface AuditEvent {
  timestamp: string;
  type: "ACCESS_GRANTED" | "ACCESS_DENIED";
  userId: string;
  resourceType: string;
  resourceId: number | string;
  reason: string;
  authMethod?: "session" | "jwt" | "api_key";
  purpose?: string;
  sessionId?: string;
}

/**
 * Logs an object-level access decision to both the structured logger
 * and the persistent patient_access_audit_logs table for HIPAA compliance.
 *
 * @param userId The ID of the authenticated user attempting access
 * @param resourceType The type of resource (e.g. "Assessment", "Patient")
 * @param resourceId The ID of the resource
 * @param granted Whether access was granted
 * @param reason The reason for the decision (authorization decision logic)
 * @param authMethod Optional authentication method used (session/jwt/api_key)
 * @param req Optional Express request for IP/User-Agent extraction
 * @param purpose Optional HIPAA-required purpose of access (required for PHI compliance)
 * @param sessionId Optional session ID for audit trail reconstruction
 */
export function logAccessAttempt(
  userId: string,
  resourceType: string,
  resourceId: number | string,
  granted: boolean,
  reason: string,
  authMethod?: "session" | "jwt" | "api_key",
  req?: Request,
  purpose?: string,
  sessionId?: string
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

  if (purpose) {
    event.purpose = purpose;
  }

  if (sessionId) {
    event.sessionId = sessionId;
  }

  if (granted) {
    logger.info({ audit: event }, "PHI Access Granted");
  } else {
    logger.warn({ audit: event, security: true }, "PHI Access Denied");
  }

  if (typeof storage.recordPatientAccess === "function") {
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
}