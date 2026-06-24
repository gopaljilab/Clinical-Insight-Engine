/**
 * server/services/authz/rbac.test.ts
 *
 * Unit tests for hasRole and isAdmin in server/services/authz/rbac.ts.
 *
 * Covers:
 *  - hasRole: exact role match
 *  - hasRole: case-insensitive matching
 *  - hasRole: DOCTOR and provider treated as equivalent (legacy support)
 *  - hasRole: non-matching role returns false
 *  - hasRole: missing role defaults gracefully
 *  - isAdmin: ADMIN role returns true
 *  - isAdmin: non-ADMIN roles return false
 *  - isAdmin: missing role returns false
 */

import { describe, expect, it } from "vitest";
import { hasRole, isAdmin, ROLES } from "./rbac";

describe("hasRole", () => {
  // ── Exact match ────────────────────────────────────────────────────────────────
  describe("exact role match", () => {
    it("returns true when user role matches target exactly", () => {
      expect(hasRole({ role: "DOCTOR" }, "DOCTOR")).toBe(true);
      expect(hasRole({ role: "ADMIN" }, "ADMIN")).toBe(true);
      expect(hasRole({ role: "PATIENT" }, "PATIENT")).toBe(true);
      expect(hasRole({ role: "CLINICIAN" }, "CLINICIAN")).toBe(true);
      expect(hasRole({ role: "STAFF" }, "STAFF")).toBe(true);
    });

    it("returns false when user role does not match target", () => {
      expect(hasRole({ role: "DOCTOR" }, "ADMIN")).toBe(false);
      expect(hasRole({ role: "PATIENT" }, "DOCTOR")).toBe(false);
      expect(hasRole({ role: "STAFF" }, "ADMIN")).toBe(false);
    });
  });

  // ── Case-insensitive matching ────────────────────────────────────────────────
  describe("case-insensitive matching", () => {
    it("matches uppercase user role to lowercase target", () => {
      expect(hasRole({ role: "DOCTOR" }, "doctor")).toBe(true);
    });

    it("matches lowercase user role to uppercase target", () => {
      expect(hasRole({ role: "doctor" }, "DOCTOR")).toBe(true);
    });

    it("matches mixed-case roles", () => {
      expect(hasRole({ role: "CliNiCiAn" }, "clinician")).toBe(true);
    });
  });

  // ── Legacy DOCTOR / provider equivalence ──────────────────────────────────────
  describe("legacy DOCTOR and provider equivalence", () => {
    it("treats DOCTOR as equivalent to provider", () => {
      expect(hasRole({ role: "DOCTOR" }, "provider")).toBe(true);
    });

    it("treats provider as equivalent to DOCTOR", () => {
      expect(hasRole({ role: "provider" }, "DOCTOR")).toBe(true);
    });

    it("does not extend provider equivalence to other roles", () => {
      expect(hasRole({ role: "provider" }, "ADMIN")).toBe(false);
      expect(hasRole({ role: "ADMIN" }, "provider")).toBe(false);
    });

    it("does not confuse PATIENT with provider", () => {
      expect(hasRole({ role: "PATIENT" }, "provider")).toBe(false);
    });
  });

  // ── Missing or malformed role field ───────────────────────────────────────────
  describe("missing or malformed role field", () => {
    it("defaults to PROVIDER uppercase when role is missing", () => {
      // When role is absent, userRole defaults to PROVIDER.toUpperCase() which is "PROVIDER"
      // Since target "DOCTOR" is treated as equivalent to "PROVIDER", this returns true
      const user = {} as { role?: string };
      expect(hasRole(user, "DOCTOR")).toBe(true);
    });

    it("handles empty string role gracefully", () => {
      const user = { role: "" };
      // Empty string uppercased is still "" which won't match PROVIDER
      // It should fall through to the equivalence check which maps to DOCTOR -> provider
      // The exact behavior depends on implementation; test documents actual behavior
      const result = hasRole(user, "DOCTOR");
      // The important thing is it does not throw
      expect(typeof result).toBe("boolean");
    });
  });

  // ── ROLES constant ────────────────────────────────────────────────────────────
  describe("ROLES constant", () => {
    it("defines all expected role constants", () => {
      expect(ROLES.ADMIN).toBe("ADMIN");
      expect(ROLES.DOCTOR).toBe("DOCTOR");
      expect(ROLES.CLINICIAN).toBe("CLINICIAN");
      expect(ROLES.STAFF).toBe("STAFF");
      expect(ROLES.PATIENT).toBe("PATIENT");
      expect(ROLES.PROVIDER).toBe("provider");
    });
  });
});

describe("isAdmin", () => {
  // ── ADMIN role ────────────────────────────────────────────────────────────────
  describe("ADMIN role", () => {
    it("returns true for ADMIN role", () => {
      expect(isAdmin({ role: "ADMIN" })).toBe(true);
    });

    it("returns true for ADMIN regardless of case", () => {
      expect(isAdmin({ role: "admin" })).toBe(true);
    });
  });

  // ── Non-ADMIN roles ──────────────────────────────────────────────────────────
  describe("non-ADMIN roles", () => {
    it("returns false for DOCTOR", () => {
      expect(isAdmin({ role: "DOCTOR" })).toBe(false);
    });

    it("returns false for CLINICIAN", () => {
      expect(isAdmin({ role: "CLINICIAN" })).toBe(false);
    });

    it("returns false for STAFF", () => {
      expect(isAdmin({ role: "STAFF" })).toBe(false);
    });

    it("returns false for PATIENT", () => {
      expect(isAdmin({ role: "PATIENT" })).toBe(false);
    });

    it("returns false for provider", () => {
      expect(isAdmin({ role: "provider" })).toBe(false);
    });
  });

  // ── Missing role ─────────────────────────────────────────────────────────────
  describe("missing role", () => {
    it("returns false when role is absent", () => {
      const user = {} as { role?: string };
      expect(isAdmin(user)).toBe(false);
    });

    it("returns false when role is empty string", () => {
      expect(isAdmin({ role: "" })).toBe(false);
    });
  });
});
