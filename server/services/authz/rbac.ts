/**
 * rbac.ts
 *
 * Role-Based Access Control definitions.
 */

import type { User } from "../../../shared/schema";

export const ROLES = {
  ADMIN: "ADMIN",
  DOCTOR: "DOCTOR",
  CLINICIAN: "CLINICIAN",
  STAFF: "STAFF",
  PATIENT: "PATIENT",
  // Legacy role used in the app, mapped to DOCTOR conceptually
  PROVIDER: "provider",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

/**
 * Checks if a user has a specific role.
 * Considers "provider" and "DOCTOR" equivalent for legacy support.
 */
export function hasRole(user: Pick<User, "role">, role: Role): boolean {
  const userRole = user.role?.toUpperCase() || ROLES.PROVIDER.toUpperCase();
  const targetRole = role.toUpperCase();
  
  if (userRole === targetRole) return true;
  
  if (targetRole === ROLES.DOCTOR && userRole === ROLES.PROVIDER.toUpperCase()) return true;
  if (targetRole === ROLES.PROVIDER.toUpperCase() && userRole === ROLES.DOCTOR) return true;
  
  return false;
}

/**
 * Checks if a user is an administrator.
 */
export function isAdmin(user: Pick<User, "role">): boolean {
  return hasRole(user, ROLES.ADMIN);
}
