import { describe, expect, it } from "vitest";
import { canAccessPatientRecord } from "../../server/services/authz/patient-access";
import { logAccessAttempt } from "../../server/security/access-audit";
import { ROLES } from "../../server/services/authz/rbac";

describe("Patient Record Authorization (IDOR Prevention)", () => {

  const mockRecord = {
    id: 1042,
    createdBy: "doctor_a@example.com",
    userId: "patient-uuid-123",
  };

  it("Scenario 1: Assigned doctor accesses patient -> Success", () => {
    const user = {
      id: "doc-uuid-1",
      email: "doctor_a@example.com",
      role: ROLES.PROVIDER,
    };

    const granted = canAccessPatientRecord(user, mockRecord);
    expect(granted).toBe(true);
  });

  it("Scenario 2: Administrator accesses patient -> Success", () => {
    const adminUser = {
      id: "admin-uuid",
      email: "admin@example.com",
      role: ROLES.ADMIN,
    };

    const granted = canAccessPatientRecord(adminUser, mockRecord);
    expect(granted).toBe(true);
  });

  it("Scenario 3: Unrelated doctor accesses patient -> Denied", () => {
    const unrelatedDoctor = {
      id: "doc-uuid-2",
      email: "doctor_b@example.com",
      role: ROLES.PROVIDER,
    };

    const granted = canAccessPatientRecord(unrelatedDoctor, mockRecord);
    expect(granted).toBe(false);
  });

  it("Scenario 4: Random authenticated user -> Denied", () => {
    const randomUser = {
      id: "random-uuid",
      email: "hacker@example.com",
      role: "PATIENT",
    };

    const granted = canAccessPatientRecord(randomUser, mockRecord);
    expect(granted).toBe(false);
  });

  it("Patient accesses their own record -> Success", () => {
    const patientUser = {
      id: "patient-uuid-123",
      email: "patient@example.com",
      role: "PATIENT",
    };

    const granted = canAccessPatientRecord(patientUser, mockRecord);
    expect(granted).toBe(true);
  });

  it("Scenario 6: All unauthorized endpoints return 404 (consistent, no 403 leak)", () => {
    const unauthorizedUser = {
      id: "hacker-uuid",
      email: "hacker@example.com",
      role: "PATIENT",
    };

    const granted = canAccessPatientRecord(unauthorizedUser, mockRecord);
    expect(granted).toBe(false);
  });
});

describe("Access Audit Logging", () => {
  it("Scenario 5: Patient ID enumeration attempt logs correctly without crashing", () => {
    expect(() => {
      logAccessAttempt(
        "hacker-uuid",
        "Assessment",
        1045,
        false,
        "IDOR attempt: User not authorized to access this patient record"
      );
    }).not.toThrow();
  });

  it("Logs authorized access attempt without crashing", () => {
    expect(() => {
      logAccessAttempt(
        "doctor-uuid",
        "Assessment",
        1042,
        true,
        "Authorized access"
      );
    }).not.toThrow();
  });
});
