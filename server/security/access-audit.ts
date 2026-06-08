/**
 * access-audit.ts
 *
 * Secure logging for authorization decisions.
 * Ensures that PHI is never written to logs while maintaining an audit trail
 * of object access, particularly denied attempts (IDOR/enumeration).
 */

import type { Request } from "express";
import { logger } from "../logger";

/**
 * Logs an object-level access decision.
 * 
 * @param req Express request (used for IP/User-Agent extraction, though omitting them here for simplicity if not available)
 * @param userId The ID of the authenticated user attempting access
 * @param resourceType The type of resource (e.g. "Assessment", "Patient")
 * @param resourceId The ID of the resource
 * @param granted Whether access was granted
 * @param reason The reason for the decision
 */
export function logAccessAttempt(
  userId: string,
  resourceType: string,
  resourceId: number | string,
  granted: boolean,
  reason: string
): void {
  const timestamp = new Date().toISOString();
  const event = {
    timestamp,
    type: granted ? "ACCESS_GRANTED" : "ACCESS_DENIED",
    userId,
    resourceType,
    resourceId,
    reason,
  };

  if (granted) {
    logger.info({ audit: event }, "Access Granted");
  } else {
    logger.warn({ audit: event, security: true }, "Access Denied");
  }
}
