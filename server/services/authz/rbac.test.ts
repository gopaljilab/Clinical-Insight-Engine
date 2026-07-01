import { describe, it, expect } from "vitest";
import { hasRole, isAdmin, ROLES } from "./rbac";

describe("ROLES", () => {
  it("exports ADMIN role", () => {
    expect(ROLES.ADMIN).toBe("ADMIN");
  });

  it("exports DOCTOR role", () => {
    expect(ROLES.DOCTOR).toBe("DOCTOR");
  });

  it("exports CLINICIAN role", () => {
    expect(ROLES.CLINICIAN).toBe("CLINICIAN");
  });

  it("exports STAFF role", () => {
    expect(ROLES.STAFF).toBe("STAFF");
  });

  it("exports PATIENT role", () => {
    expect(ROLES.PATIENT).toBe("PATIENT");
  });

  it("exports PROVIDER legacy role", () => {
    expect(ROLES.PROVIDER).toBe("provider");
  });
});

describe("hasRole", () => {
  it("returns true when user has the specified role (uppercase)", () => {
    const user = { role: "DOCTOR" };
    expect(hasRole(user, ROLES.DOCTOR)).toBe(true);
  });

  it("returns false when user lacks the specified role", () => {
    const user = { role: "PATIENT" };
    expect(hasRole(user, ROLES.DOCTOR)).toBe(false);
  });

  it("returns true for ADMIN matching ADMIN role", () => {
    const user = { role: "ADMIN" };
    expect(hasRole(user, ROLES.ADMIN)).toBe(true);
  });

  it("returns false for non-admin role", () => {
    const user = { role: "ADMIN" };
    expect(hasRole(user, ROLES.DOCTOR)).toBe(false);
  });

  it("handles CLINICIAN role correctly", () => {
    const user = { role: "CLINICIAN" };
    expect(hasRole(user, ROLES.CLINICIAN)).toBe(true);
    expect(hasRole(user, ROLES.DOCTOR)).toBe(false);
  });

  it("is case-insensitive for user role (uppercases internally)", () => {
    const user = { role: "doctor" };
    expect(hasRole(user, ROLES.DOCTOR)).toBe(true);
  });

  it("treats DOCTOR and provider as equivalent (legacy support)", () => {
    const doctor = { role: "DOCTOR" };
    const provider = { role: "provider" };
    expect(hasRole(doctor, ROLES.PROVIDER)).toBe(true);
    expect(hasRole(provider, ROLES.DOCTOR)).toBe(true);
  });
});

describe("isAdmin", () => {
  it("returns true for ADMIN user", () => {
    const user = { role: "ADMIN" };
    expect(isAdmin(user)).toBe(true);
  });

  it("returns false for DOCTOR", () => {
    const user = { role: "DOCTOR" };
    expect(isAdmin(user)).toBe(false);
  });

  it("returns false for CLINICIAN", () => {
    const user = { role: "CLINICIAN" };
    expect(isAdmin(user)).toBe(false);
  });

  it("returns false for PATIENT", () => {
    const user = { role: "PATIENT" };
    expect(isAdmin(user)).toBe(false);
  });

  it("returns true for admin (case-insensitive)", () => {
    const user = { role: "admin" };
    expect(isAdmin(user)).toBe(true);
  });
});
