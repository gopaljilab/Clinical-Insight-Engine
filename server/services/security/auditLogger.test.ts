/**
 * Unit tests for server/services/security/auditLogger.ts
 * Tests PII masking, error serialization, and log payload construction.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { logger } from "../../logger";
import { logAuditEvent, generateRequestId } from "./auditLogger";

// ─── mock logger ─────────────────────────────────────────────────────────────

const warnSpy = vi.spyOn(logger, "warn").mockReturnValue(undefined);

beforeEach(() => {
  warnSpy.mockClear();
});

// ─── logAuditEvent Tests ─────────────────────────────────────────────────────

describe("logAuditEvent", () => {
  it("logs a basic audit event with timestamp and message", () => {
    logAuditEvent("User login attempt", { requestId: "req-123" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [meta, msg] = warnSpy.mock.calls[0];
    expect(meta.auditLog.timestamp).toBeTruthy();
    expect(meta.auditLog.message).toBe("User login attempt");
    expect(meta.auditLog.requestId).toBe("req-123");
    expect(msg).toBe("Security Audit Event");
  });

  it("masks ssn field", () => {
    logAuditEvent("PHI access", { requestId: "req-1", ssn: "123-45-6789" });
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.ssn).toMatch(/(\*\*\*-MASKED-\*\*\*|\[REDACTED\])/);
  });

  it("masks password field", () => {
    logAuditEvent("Auth attempt", { requestId: "req-1", password: "SuperSecret123" });
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.password).toMatch(/(\*\*\*-MASKED-\*\*\*|\[REDACTED\])/);
  });

  it("masks passwordHash field (case-insensitive key check)", () => {
    logAuditEvent("Auth attempt", { requestId: "req-1", passwordHash: "abc123hash" });
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.passwordHash).toMatch(/(\*\*\*-MASKED-\*\*\*|\[REDACTED\])/);
  });

  it("masks email field", () => {
    logAuditEvent("User action", { requestId: "req-1", email: "doctor@hospital.org" });
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.email).toMatch(/(\*\*\*-MASKED-\*\*\*|\[REDACTED\])/);
  });

  it("masks fullName field", () => {
    logAuditEvent("User action", { requestId: "req-1", fullName: "Dr. Jane Doe" });
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.fullName).toMatch(/(\*\*\*-MASKED-\*\*\*|\[REDACTED\])/);
  });

  it("masks medicalLicenseNumber field", () => {
    logAuditEvent("Auth check", { requestId: "req-1", medicalLicenseNumber: "MD-999999" });
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.medicalLicenseNumber).toMatch(/(\*\*\*-MASKED-\*\*\*|\[REDACTED\])/);
  });

  it("masks patientName field", () => {
    logAuditEvent("Record access", { requestId: "req-1", patientName: "John Doe" });
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.patientName).toMatch(/(\*\*\*-MASKED-\*\*\*|\[REDACTED\])/);
  });

  it("does not mask non-sensitive fields", () => {
    logAuditEvent("Request processed", { requestId: "req-1", statusCode: 200, method: "POST", path: "/api/assessments" });
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.statusCode).toBe(200);
    expect(meta.auditLog.method).toBe("POST");
    expect(meta.auditLog.path).toBe("/api/assessments");
  });

  it("recursively masks nested objects", () => {
    const details = {
      requestId: "req-1",
      user: {
        email: "user@hospital.org",
        fullName: "John Smith",
        role: "doctor",
      },
    };
    logAuditEvent("User lookup", details);
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.user.email).toMatch(/(\*\*\*-MASKED-\*\*\*|\[REDACTED\])/);
    expect(meta.auditLog.user.fullName).toMatch(/(\*\*\*-MASKED-\*\*\*|\[REDACTED\])/);
    expect(meta.auditLog.user.role).toBe("doctor");
  });

  it("serializes Error instances", () => {
    const err = new Error("Database connection failed");
    logAuditEvent("Database error", { requestId: "req-1" }, err);
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.errorName).toBe("Error");
    expect(meta.auditLog.errorMessage).toBe("Database connection failed");
    expect(meta.auditLog.stackTrace).toBeTruthy();
  });

  it("serializes non-Error throwables as string", () => {
    logAuditEvent("Unexpected error", { requestId: "req-1" }, "Something went wrong");
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.rawError).toBe("Something went wrong");
  });

  it("includes requestId in log payload", () => {
    logAuditEvent("Test event", { requestId: "req-abc-123" });
    const [meta] = warnSpy.mock.calls[0];
    expect(meta.auditLog.requestId).toBe("req-abc-123");
  });
});

// ─── generateRequestId Tests ─────────────────────────────────────────────────

describe("generateRequestId", () => {
  it("returns a non-empty string", () => {
    const id = generateRequestId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique IDs on consecutive calls", () => {
    const id1 = generateRequestId();
    const id2 = generateRequestId();
    expect(id1).not.toBe(id2);
  });

  it("returns a valid UUID format", () => {
    const id = generateRequestId();
    // UUID v4 format: 8-4-4-4-12 hex digits
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});