/**
 * patient-access.ts
 *
 * Centralized authorization service for patient records.
 * Enforces Object-Level Authorization based on role and ownership.
 */

import type { User, Assessment } from "../../../shared/schema";
import { isAdmin } from "./rbac";

/**
 * Determines if a user has permission to access a specific patient record (Assessment).
 *
 * Authorization logic:
 * - Administrators have global access.
 * - Providers (Doctors/Clinicians) can only access records they created.
 * - Patients can only access their own records (userId matches).
 *
 * @param user The authenticated user attempting access
 * @param record The patient record (Assessment) being accessed
 * @returns true if access is granted, false otherwise
 */
export function canAccessPatientRecord(
  user: Pick<User, "id" | "email" | "role">,
  record: Pick<Assessment, "createdBy" | "userId">
): boolean {
  // 1. System administrators have global access
  if (isAdmin(user)) {
    return true;
  }

  // 2. Providers have access if they created the record (assignment check)
  if (record.createdBy && record.createdBy.toLowerCase() === user.email.toLowerCase()) {
    return true;
  }

  // 3. Patients have access if the record belongs directly to them
  if (record.userId && record.userId === user.id) {
    return true;
  }

  // Default deny (fail-safe)
  return false;
}
