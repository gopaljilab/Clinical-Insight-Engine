/**
 * shared/schemas/errorResponse.test.ts
 *
 * Unit tests for createErrorResponse and errorResponseSchema in shared/schemas/errorResponse.ts.
 *
 * Covers:
 *  - createErrorResponse: returns object with message and requestId
 *  - createErrorResponse: requestId must be a valid UUID
 *  - createErrorResponse: message is preserved exactly
 *  - errorResponseSchema: accepts valid { message: string, requestId?: uuid }
 *  - errorResponseSchema: rejects missing message
 *  - errorResponseSchema: rejects non-string message
 *  - errorResponseSchema: rejects invalid UUID for requestId
 */

import { describe, expect, it } from "vitest";
import { createErrorResponse, errorResponseSchema } from "./errorResponse";

describe("createErrorResponse", () => {
  it("returns an object with both message and requestId fields", () => {
    const result = createErrorResponse("Something went wrong", "12345678-1234-1234-1234-123456789012");
    expect(result).toHaveProperty("message");
    expect(result).toHaveProperty("requestId");
  });

  it("preserves the message exactly", () => {
    const msg = "Custom error: invalid input received";
    const result = createErrorResponse(msg, "12345678-1234-1234-1234-123456789012");
    expect(result.message).toBe(msg);
  });

  it("includes the requestId exactly", () => {
    const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const result = createErrorResponse("Error", id);
    expect(result.requestId).toBe(id);
  });

  it("does not add extra fields", () => {
    const result = createErrorResponse("Error", "12345678-1234-1234-1234-123456789012");
    const keys = Object.keys(result).sort();
    expect(keys).toEqual(["message", "requestId"]);
  });

  it("handles empty string message", () => {
    const result = createErrorResponse("", "12345678-1234-1234-1234-123456789012");
    expect(result.message).toBe("");
  });

  it("handles unicode message", () => {
    const msg = "Error: \u4e2d\u6587\u6d88\u606f";
    const result = createErrorResponse(msg, "12345678-1234-1234-1234-123456789012");
    expect(result.message).toBe(msg);
  });
});

describe("errorResponseSchema", () => {
  // ── Valid inputs ─────────────────────────────────────────────────────────────
  describe("valid inputs", () => {
    it("accepts an object with message and a valid UUID requestId", () => {
      const result = errorResponseSchema.safeParse({
        message: "Not found",
        requestId: "12345678-1234-1234-1234-123456789012",
      });
      expect(result.success).toBe(true);
    });

    it("accepts an object with message and no requestId", () => {
      const result = errorResponseSchema.safeParse({ message: "Bad request" });
      expect(result.success).toBe(true);
    });

    it("accepts an object with only a message (string)", () => {
      const result = errorResponseSchema.safeParse({ message: "OK" });
      expect(result.success).toBe(true);
    });

    it("accepts minimal valid input", () => {
      const result = errorResponseSchema.safeParse({ message: "" });
      expect(result.success).toBe(true);
    });
  });

  // ── Invalid message field ────────────────────────────────────────────────────
  describe("invalid message field", () => {
    it("rejects missing message", () => {
      const result = errorResponseSchema.safeParse({ requestId: "12345678-1234-1234-1234-123456789012" });
      expect(result.success).toBe(false);
    });

    it("rejects null message", () => {
      const result = errorResponseSchema.safeParse({ message: null });
      expect(result.success).toBe(false);
    });

    it("rejects undefined message", () => {
      // @ts-ignore - intentional invalid input for schema test
      const result = errorResponseSchema.safeParse({ message: undefined });
      expect(result.success).toBe(false);
    });

    it("rejects number message", () => {
      // @ts-ignore - intentional invalid input for schema test
      const result = errorResponseSchema.safeParse({ message: 42 });
      expect(result.success).toBe(false);
    });

    it("rejects boolean message", () => {
      // @ts-ignore - intentional invalid input for schema test
      const result = errorResponseSchema.safeParse({ message: true });
      expect(result.success).toBe(false);
    });

    it("rejects array message", () => {
      // @ts-ignore - intentional invalid input for schema test
      const result = errorResponseSchema.safeParse({ message: ["error"] });
      expect(result.success).toBe(false);
    });
  });

  // ── Invalid requestId field ──────────────────────────────────────────────────
  describe("invalid requestId field", () => {
    it("rejects non-UUID string as requestId", () => {
      const result = errorResponseSchema.safeParse({
        message: "Error",
        requestId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("rejects numeric requestId", () => {
      // @ts-ignore - intentional invalid input for schema test
      const result = errorResponseSchema.safeParse({ message: "Error", requestId: 42 });
      expect(result.success).toBe(false);
    });

    it("rejects empty string as requestId", () => {
      const result = errorResponseSchema.safeParse({ message: "Error", requestId: "" });
      expect(result.success).toBe(false);
    });

    it("rejects UUID with wrong format", () => {
      const result = errorResponseSchema.safeParse({
        message: "Error",
        requestId: "12345678123412341234123456789012", // 32 hex chars, not UUID format
      });
      expect(result.success).toBe(false);
    });

    it("accepts UUIDv1 as requestId (v1 is valid UUID format)", () => {
      const result = errorResponseSchema.safeParse({
        message: "Error",
        requestId: "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      });
      expect(result.success).toBe(true);
    });
  });

  // ── Extra fields ─────────────────────────────────────────────────────────────
  describe("extra fields", () => {
    it("accepts extra fields without rejecting (no strict mode)", () => {
      // The schema does not use .strict() so extra fields are accepted and stripped in output
      const result = errorResponseSchema.safeParse({
        message: "Error",
        requestId: "12345678-1234-1234-1234-123456789012",
        extra: "unknown",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        // Extra fields are stripped from the parsed output
        expect(Object.keys(result.data)).toEqual(["message", "requestId"]);
      }
    });
  });
});
