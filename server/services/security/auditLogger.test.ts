import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAuditEvent, generateRequestId } from "./auditLogger";

const mockWarn = vi.fn();
vi.mock("../../logger", () => ({
  logger: {
    warn: (...args: any[]) => mockWarn(...args),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("auditLogger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("maskSensitiveData", () => {
    it("masks SSN field with ***-MASKED-***", () => {
      logAuditEvent("Test event", {
        requestId: "req-123",
        ssn: "123-45-6789",
        path: "/api/patients",
      });

      const warnArg = mockWarn.mock.calls[0][0];
      expect(warnArg.auditLog.ssn).toBe("***-MASKED-***");
      expect(warnArg.auditLog.requestId).toBe("req-123");
    });

    it("masks password field", () => {
      logAuditEvent("Login event", {
        requestId: "req-456",
        password: "supersecret",
        email: "user@example.com",
      });

      const warnArg = mockWarn.mock.calls[0][0];
      expect(warnArg.auditLog.password).toBe("***-MASKED-***");
      expect(warnArg.auditLog.email).toBe("***-MASKED-***");
    });

    it("masks patientName field", () => {
      logAuditEvent("Patient access", {
        requestId: "req-789",
        patientName: "John Doe",
      });

      const warnArg = mockWarn.mock.calls[0][0];
      expect(warnArg.auditLog.patientName).toBe("***-MASKED-***");
    });

    it("masks medicallicensenumber (case-insensitive)", () => {
      logAuditEvent("Licensed access", {
        requestId: "req-abc",
        medicallicensenumber: "MD-123456",
        MedicalLicenseNumber: "RN-789012",
      });

      const warnArg = mockWarn.mock.calls[0][0];
      expect(warnArg.auditLog.medicallicensenumber).toBe("***-MASKED-***");
      expect(warnArg.auditLog.MedicalLicenseNumber).toBe("***-MASKED-***");
    });

    it("recursively masks sensitive fields in nested objects", () => {
      logAuditEvent("Nested event", {
        requestId: "req-nested",
        user: {
          email: "admin@clinic.com",
          fullname: "Admin User",
          level: 5,
        },
      });

      const warnArg = mockWarn.mock.calls[0][0];
      expect(warnArg.auditLog.user.email).toBe("***-MASKED-***");
      expect(warnArg.auditLog.user.fullname).toBe("***-MASKED-***");
      expect(warnArg.auditLog.user.level).toBe(5);
    });

    it("preserves non-sensitive fields unchanged", () => {
      logAuditEvent("Request event", {
        requestId: "req-preserve",
        method: "POST",
        path: "/api/assessments",
        statusCode: 201,
        count: 42,
      });

      const warnArg = mockWarn.mock.calls[0][0];
      expect(warnArg.auditLog.method).toBe("POST");
      expect(warnArg.auditLog.path).toBe("/api/assessments");
      expect(warnArg.auditLog.statusCode).toBe(201);
      expect(warnArg.auditLog.count).toBe(42);
    });
  });

  describe("logAuditEvent", () => {
    it("calls logger.warn with correct message and audit payload", () => {
      logAuditEvent("Security Incident", {
        requestId: "req-alert",
      });

      expect(mockWarn).toHaveBeenCalledTimes(1);
      const [logObj, message] = mockWarn.mock.calls[0];
      expect(message).toBe("Security Audit Event");
      expect(logObj.auditLog.message).toBe("Security Incident");
      expect(logObj.auditLog.timestamp).toBe("2026-01-15T12:00:00.000Z");
    });

    it("includes errorName, errorMessage, and stackTrace when error is an Error instance", () => {
      const testError = new Error("Database connection failed");
      testError.name = "ConnectionError";

      logAuditEvent("Unhandled error", {
        requestId: "req-err",
      }, testError);

      const warnArg = mockWarn.mock.calls[0][0];
      expect(warnArg.auditLog.errorName).toBe("ConnectionError");
      expect(warnArg.auditLog.errorMessage).toBe("Database connection failed");
      expect(warnArg.auditLog.stackTrace).toContain("Database connection failed");
    });

    it("includes rawError string when error is not an Error instance", () => {
      logAuditEvent("Raw error", {
        requestId: "req-raw",
      }, "Something went wrong: code 500");

      const warnArg = mockWarn.mock.calls[0][0];
      expect(warnArg.auditLog.rawError).toBe("Something went wrong: code 500");
    });

    it("omits error fields when no error is passed", () => {
      logAuditEvent("No error event", {
        requestId: "req-ok",
      });

      const warnArg = mockWarn.mock.calls[0][0];
      expect(warnArg.auditLog).not.toHaveProperty("errorName");
      expect(warnArg.auditLog).not.toHaveProperty("rawError");
    });
  });

  describe("generateRequestId", () => {
    it("returns a non-empty string", () => {
      const id = generateRequestId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("returns a valid UUID v4 format string", () => {
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const id = generateRequestId();
      expect(id).toMatch(uuidV4Regex);
    });

    it("returns unique values on repeated calls", () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateRequestId()));
      expect(ids.size).toBe(100);
    });
  });
});
