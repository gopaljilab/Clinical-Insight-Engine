import { describe, expect, it } from "vitest";
import { errorResponseSchema, createErrorResponse } from "./errorResponse";

describe("errorResponseSchema", () => {
  it("accepts a valid response with a message", () => {
    const result = errorResponseSchema.safeParse({ message: "Something went wrong" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe("Something went wrong");
    }
  });

  it("accepts a response with optional requestId UUID", () => {
    const result = errorResponseSchema.safeParse({
      message: "Internal error",
      requestId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestId).toBe("550e8400-e29b-41d4-a716-446655440000");
    }
  });

  it("accepts a response with message only and no requestId", () => {
    const result = errorResponseSchema.safeParse({ message: "Not found" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestId).toBeUndefined();
    }
  });

  it("rejects an empty object", () => {
    const result = errorResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects a response with missing message", () => {
    const result = errorResponseSchema.safeParse({ requestId: "123" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-string message", () => {
    const result = errorResponseSchema.safeParse({ message: 12345 });
    expect(result.success).toBe(false);
  });

  it("rejects a requestId that is not a valid UUID", () => {
    const result = errorResponseSchema.safeParse({
      message: "Error",
      requestId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a requestId that is a number instead of a string", () => {
    const result = errorResponseSchema.safeParse({
      message: "Error",
      requestId: 12345 as any,
    });
    expect(result.success).toBe(false);
  });
});

describe("createErrorResponse", () => {
  it("returns an object with message and requestId fields", () => {
    const response = createErrorResponse("Database error", "f47ac10b-58cc-4372-a567-0e02b2c3d479");
    expect(response).toHaveProperty("message");
    expect(response).toHaveProperty("requestId");
    expect(response.message).toBe("Database error");
    expect(response.requestId).toBe("f47ac10b-58cc-4372-a567-0e02b2c3d479");
  });

  it("passes schema validation for valid UUID input", () => {
    const response = createErrorResponse("Test error", "6ba7b810-9dad-11d1-80b4-00c04fd430c8");
    const result = errorResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
  });

  it("returns message as the first property", () => {
    const response = createErrorResponse("Timeout", "abc12300-abcd-1234-ef00-1234567890ab");
    const keys = Object.keys(response);
    expect(keys[0]).toBe("message");
    expect(keys[1]).toBe("requestId");
  });
});
