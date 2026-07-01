import { describe, it, expect } from "vitest";
import { canAccessPatientRecord } from "./patient-access";

describe("canAccessPatientRecord", () => {
  describe("admin access", () => {
    it("grants admin global access to any record", () => {
      const user = { id: "admin-1", email: "admin@test.com", role: "admin" };
      const record = { createdBy: "doctor@test.com", userId: "patient-1", ownerId: "patient-1" };
      expect(canAccessPatientRecord(user, record)).toBe(true);
    });

    it("grants admin access even with no matching fields", () => {
      const user = { id: "admin-1", email: "admin@test.com", role: "admin" };
      const record = { createdBy: "other@test.com", userId: "other-patient", ownerId: "other-owner" };
      expect(canAccessPatientRecord(user, record)).toBe(true);
    });
  });

  describe("ownerId matching", () => {
    it("grants access when ownerId matches user id", () => {
      const user = { id: "patient-1", email: "patient@test.com", role: "patient" };
      const record = { createdBy: "doctor@test.com", userId: "other", ownerId: "patient-1" };
      expect(canAccessPatientRecord(user, record)).toBe(true);
    });

    it("denies access when ownerId does not match user id", () => {
      const user = { id: "patient-1", email: "patient@test.com", role: "patient" };
      const record = { createdBy: "doctor@test.com", userId: "other", ownerId: "different-owner" };
      expect(canAccessPatientRecord(user, record)).toBe(false);
    });

    it("denies access when ownerId is undefined", () => {
      const user = { id: "patient-1", email: "patient@test.com", role: "patient" };
      const record = { createdBy: "doctor@test.com", userId: "other", ownerId: undefined as any };
      expect(canAccessPatientRecord(user, record)).toBe(false);
    });
  });

  describe("createdBy email matching", () => {
    it("grants access when createdBy email matches user email", () => {
      const user = { id: "doctor-1", email: "Doctor@test.com", role: "doctor" };
      const record = { createdBy: "doctor@test.com", userId: "other", ownerId: undefined as any };
      expect(canAccessPatientRecord(user, record)).toBe(true);
    });

    it("grants access with case-insensitive email comparison", () => {
      const user = { id: "doctor-1", email: "DOCTOR@TEST.COM", role: "doctor" };
      const record = { createdBy: "doctor@test.com", userId: "other", ownerId: undefined as any };
      expect(canAccessPatientRecord(user, record)).toBe(true);
    });

    it("denies access when createdBy email does not match", () => {
      const user = { id: "doctor-1", email: "other@test.com", role: "doctor" };
      const record = { createdBy: "doctor@test.com", userId: "other", ownerId: undefined as any };
      expect(canAccessPatientRecord(user, record)).toBe(false);
    });

    it("denies access when createdBy is undefined", () => {
      const user = { id: "doctor-1", email: "doctor@test.com", role: "doctor" };
      const record = { createdBy: undefined as any, userId: "other", ownerId: undefined as any };
      expect(canAccessPatientRecord(user, record)).toBe(false);
    });
  });

  describe("userId matching", () => {
    it("grants access when userId matches user id", () => {
      const user = { id: "patient-1", email: "patient@test.com", role: "patient" };
      const record = { createdBy: "doctor@test.com", userId: "patient-1", ownerId: undefined as any };
      expect(canAccessPatientRecord(user, record)).toBe(true);
    });

    it("denies access when userId does not match user id", () => {
      const user = { id: "patient-1", email: "patient@test.com", role: "patient" };
      const record = { createdBy: "doctor@test.com", userId: "different-patient", ownerId: undefined as any };
      expect(canAccessPatientRecord(user, record)).toBe(false);
    });

    it("denies access when userId is undefined", () => {
      const user = { id: "patient-1", email: "patient@test.com", role: "patient" };
      const record = { createdBy: "doctor@test.com", userId: undefined as any, ownerId: undefined as any };
      expect(canAccessPatientRecord(user, record)).toBe(false);
    });
  });

  describe("default deny", () => {
    it("denies access when no condition matches", () => {
      const user = { id: "patient-1", email: "patient@test.com", role: "patient" };
      const record = {
        createdBy: "doctor@test.com",
        userId: "different-patient",
        ownerId: "different-owner",
      };
      expect(canAccessPatientRecord(user, record)).toBe(false);
    });

    it("denies access for clinician with no matching fields", () => {
      const user = { id: "clinician-1", email: "clinician@test.com", role: "clinician" };
      const record = {
        createdBy: "other@test.com",
        userId: "other-patient",
        ownerId: "other-owner",
      };
      expect(canAccessPatientRecord(user, record)).toBe(false);
    });
  });
});
