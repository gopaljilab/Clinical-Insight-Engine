import { describe, expect, it, vi, beforeEach } from "vitest";
import { logAuditEvent, maskSensitiveData, generateRequestId } from "./auditLogger";
import { logger } from "../../logger";

// Mock the logger module before tests run
vi.mock("../../logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("generateRequestId", () => {
  it("returns a valid UUID string", () => {
    const id = generateRequestId();
    // UUID v4 format: 8-4-4-4-12 hex digits
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("each call returns a unique value", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
    expect(ids.size).toBe(100);
  });
});

describe("maskSensitiveData", () => {
  it("masks ssn field", () => {
    const data = { ssn: "123-45-6789" };
    const result = maskSensitiveData(data);
    expect(result.ssn).toBe("***-MASKED-***");
  });

  it("masks password field", () => {
    const data = { password: "supersecret" };
    const result = maskSensitiveData(data);
    expect(result.password).toBe("***-MASKED-***");
  });

  it("masks passwordHash field", () => {
    const data = { passwordHash: "abc123hash" };
    const result = maskSensitiveData(data);
    expect(result.passwordHash).toBe("***-MASKED-***");
  });

  it("masks email field", () => {
    const data = { email: "patient@example.com" };
    const result = maskSensitiveData(data);
    expect(result.email).toBe("***-MASKED-***");
  });

  it("masks fullName field", () => {
    const data = { fullName: "John Doe" };
    const result = maskSensitiveData(data);
    expect(result.fullName).toBe("***-MASKED-***");
  });

  it("masks patientName field", () => {
    const data = { patientName: "Jane Doe" };
    const result = maskSensitiveData(data);
    expect(result.patientName).toBe("***-MASKED-***");
  });

  it("masks medicalLicenseNumber field", () => {
    const data = { medicalLicenseNumber: "MD123456" };
    const result = maskSensitiveData(data);
    expect(result.medicalLicenseNumber).toBe("***-MASKED-***");
  });

  it("masks keys case-insensitively", () => {
    const data = { SSN: "123", EMAIL: "test@test.com", PatientName: "John" };
    const result = maskSensitiveData(data);
    expect(result.SSN).toBe("***-MASKED-***");
    expect(result.EMAIL).toBe("***-MASKED-***");
    expect(result.PatientName).toBe("***-MASKED-***");
  });

  it("does not mask non-sensitive fields", () => {
    const data = { age: 45, bmi: 24.5, riskScore: 12.3, status: "ok" };
    const result = maskSensitiveData(data);
    expect(result.age).toBe(45);
    expect(result.bmi).toBe(24.5);
    expect(result.riskScore).toBe(12.3);
    expect(result.status).toBe("ok");
  });

  it("recursively masks nested objects", () => {
    const data = {
      user: {
        email: "john@example.com",
        age: 45,
      },
    };
    const result = maskSensitiveData(data);
    expect(result.user.email).toBe("***-MASKED-***");
    expect(result.user.age).toBe(45);
  });

  it("recursively masks arrays of objects", () => {
    const data = {
      records: [
        { email: "a@test.com", age: 30 },
        { email: "b@test.com", age: 40 },
      ],
    };
    const result = maskSensitiveData(data);
    expect(result.records[0].email).toBe("***-MASKED-***");
    expect(result.records[0].age).toBe(30);
    expect(result.records[1].email).toBe("***-MASKED-***");
    expect(result.records[1].age).toBe(40);
  });

  it("handles null gracefully", () => {
    expect(() => maskSensitiveData(null as any)).not.toThrow();
  });

  it("handles undefined gracefully", () => {
    expect(() => maskSensitiveData(undefined as any)).not.toThrow();
  });

  it("returns a copy, does not mutate original", () => {
    const original = { email: "test@test.com" };
    const result = maskSensitiveData(original);
    expect(result).not.toBe(original);
    expect(original.email).toBe("test@test.com"); // original unchanged
  });

  it("handles empty object", () => {
    const result = maskSensitiveData({});
    expect(result).toEqual({});
  });
});

describe("logAuditEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls logger.warn with audit log payload", () => {
    logAuditEvent("Test event", { requestId: "req-123" });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const [meta, message] = logger.warn.mock.calls[0];
    expect(meta).toHaveProperty("auditLog");
    expect(message).toBe("Security Audit Event");
  });

  it("includes timestamp in the log payload", () => {
    logAuditEvent("Test event", { requestId: "req-123" });
    const [meta] = logger.warn.mock.calls[0];
    expect(meta.auditLog).toHaveProperty("timestamp");
    // Should be ISO 8601 format
    expect(() => new Date(meta.auditLog.timestamp)).not.toThrow();
  });

  it("includes the message in the log payload", () => {
    logAuditEvent("Patient record accessed", { requestId: "req-456" });
    const [meta] = logger.warn.mock.calls[0];
    expect(meta.auditLog.message).toBe("Patient record accessed");
  });

  it("includes masked details in the log payload", () => {
    logAuditEvent("Test event", {
      requestId: "req-789",
      email: "patient@hospital.org",
      age: 50,
    });
    const [meta] = logger.warn.mock.calls[0];
    expect(meta.auditLog.email).toBe("***-MASKED-***");
    expect(meta.auditLog.age).toBe(50);
  });

  it("includes error details when Error instance is passed", () => {
    const err = new Error("Access denied");
    logAuditEvent("Error event", { requestId: "req-error" }, err);
    const [meta] = logger.warn.mock.calls[0];
    expect(meta.auditLog.errorName).toBe("Error");
    expect(meta.auditLog.errorMessage).toBe("Access denied");
    expect(meta.auditLog).toHaveProperty("stackTrace");
  });

  it("includes rawError string when non-Error is passed", () => {
    logAuditEvent("Error event", { requestId: "req-error" }, "Something went wrong");
    const [meta] = logger.warn.mock.calls[0];
    expect(meta.auditLog.rawError).toBe("Something went wrong");
  });

  it("does not include error fields when no error is passed", () => {
    logAuditEvent("Normal event", { requestId: "req-normal" });
    const [meta] = logger.warn.mock.calls[0];
    expect(meta.auditLog).not.toHaveProperty("errorName");
    expect(meta.auditLog).not.toHaveProperty("rawError");
  });
});
