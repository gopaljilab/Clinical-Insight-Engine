import { describe, it, expect, vi, beforeEach } from "vitest";
import { logAuditEvent, generateRequestId } from "../server/services/security/auditLogger";

const { mockWarn } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
}));

vi.mock("../server/logger", () => ({
  logger: {
    warn: mockWarn,
  },
}));

describe("auditLogger", () => {
  beforeEach(() => {
    mockWarn.mockClear();
  });

  describe("generateRequestId", () => {
    it("returns a valid UUID format", () => {
      const id = generateRequestId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("returns different values on successive calls", () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("logAuditEvent", () => {
    it("logs a basic event without error", () => {
      logAuditEvent("Test event", { requestId: "req-123" });
      expect(mockWarn).toHaveBeenCalledTimes(1);
      const loggedArg = mockWarn.mock.calls[0][0];
      const loggedMsg = mockWarn.mock.calls[0][1];
      expect(loggedArg).toHaveProperty("auditLog");
      expect(loggedArg.auditLog.message).toBe("Test event");
      expect(loggedArg.auditLog.requestId).toBe("req-123");
      expect(loggedArg.auditLog.timestamp).toBeDefined();
    });

    it("logs an event with an Error object", () => {
      const err = new Error("Something went wrong");
      logAuditEvent("Error event", { requestId: "req-456" }, err);
      expect(mockWarn).toHaveBeenCalledTimes(1);
      const loggedArg = mockWarn.mock.calls[0][0];
      expect(loggedArg.auditLog.errorName).toBe("Error");
      expect(loggedArg.auditLog.errorMessage).toBe("Something went wrong");
      expect(loggedArg.auditLog.stackTrace).toBeDefined();
    });

    it("logs an event with a plain string error", () => {
      logAuditEvent("String error event", { requestId: "req-789" }, "plain error string");
      expect(mockWarn).toHaveBeenCalledTimes(1);
      const loggedArg = mockWarn.mock.calls[0][0];
      expect(loggedArg.auditLog.rawError).toBe("plain error string");
    });

    it("masks sensitive fields in details", () => {
      logAuditEvent("Sensitive event", {
        requestId: "req-sens",
        email: "patient@example.com",
        ssn: "123-45-6789",
        patientName: "John Doe",
        action: "view",
      });
      expect(mockWarn).toHaveBeenCalledTimes(1);
      const loggedArg = mockWarn.mock.calls[0][0];
      expect(loggedArg.auditLog.email).toBe("***-MASKED-***");
      expect(loggedArg.auditLog.ssn).toBe("***-MASKED-***");
      expect(loggedArg.auditLog.patientName).toBe("***-MASKED-***");
      expect(loggedArg.auditLog.action).toBe("view");
    });

    it("recursively masks sensitive fields in nested objects", () => {
      logAuditEvent("Nested event", {
        requestId: "req-nested",
        nested: {
          email: "nested@example.com",
          safeField: "visible",
        },
      });
      const loggedArg = mockWarn.mock.calls[0][0];
      expect(loggedArg.auditLog.nested.email).toBe("***-MASKED-***");
      expect(loggedArg.auditLog.nested.safeField).toBe("visible");
    });

    it("handles unknown keys without masking", () => {
      logAuditEvent("Unknown fields event", {
        requestId: "req-unknown",
        someOtherField: "keep this",
        count: 42,
      });
      const loggedArg = mockWarn.mock.calls[0][0];
      expect(loggedArg.auditLog.someOtherField).toBe("keep this");
      expect(loggedArg.auditLog.count).toBe(42);
    });

    it("handles missing optional fields in details", () => {
      logAuditEvent("Minimal event", { requestId: "req-min" });
      expect(mockWarn).toHaveBeenCalledTimes(1);
      const loggedArg = mockWarn.mock.calls[0][0];
      expect(loggedArg.auditLog.requestId).toBe("req-min");
    });
  });
});
