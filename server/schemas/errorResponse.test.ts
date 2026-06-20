import { describe, it, expect } from "vitest";
import { errorResponseSchema, createErrorResponse } from "@shared/schemas/errorResponse";

describe("errorResponseSchema", () => {
  it("parses a valid error response with only message", () => {
    const result = errorResponseSchema.parse({ message: "Something went wrong" });
    expect(result.message).toBe("Something went wrong");
    expect(result.requestId).toBeUndefined();
  });

  it("parses a valid error response with message and requestId", () => {
    const result = errorResponseSchema.parse({
      message: "Not found",
      requestId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.message).toBe("Not found");
    expect(result.requestId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("fails when message is missing", () => {
    expect(() => errorResponseSchema.parse({})).toThrow();
  });

  it("fails when message is not a string", () => {
    expect(() => errorResponseSchema.parse({ message: 123 })).toThrow();
    expect(() => errorResponseSchema.parse({ message: null })).toThrow();
    expect(() => errorResponseSchema.parse({ message: undefined })).toThrow();
  });

  it("fails when requestId is not a valid UUID", () => {
    expect(() =>
      errorResponseSchema.parse({ message: "Error", requestId: "not-a-uuid" })
    ).toThrow();
    expect(() =>
      errorResponseSchema.parse({ message: "Error", requestId: "12345" })
    ).toThrow();
    expect(() =>
      errorResponseSchema.parse({ message: "Error", requestId: "" })
    ).toThrow();
  });

  it("succeeds when requestId is omitted entirely", () => {
    const result = errorResponseSchema.parse({ message: "Server error" });
    expect(result.message).toBe("Server error");
    expect(result.requestId).toBeUndefined();
  });
});

describe("createErrorResponse", () => {
  it("creates an error response with message and requestId", () => {
    const response = createErrorResponse(
      "Internal server error",
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    );
    expect(response.message).toBe("Internal server error");
    expect(response.requestId).toBe("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  it("the returned object matches the errorResponseSchema", () => {
    const response = createErrorResponse("Bad request", "12345678-1234-1234-1234-123456789012");
    expect(() => errorResponseSchema.parse(response)).not.toThrow();
  });

  it("returns the correct shape with both fields present", () => {
    const response = createErrorResponse("Unauthorized", "abc12345-6789-0abc-def0-123456789abc");
    expect(Object.keys(response)).toEqual(["message", "requestId"]);
    expect(typeof response.message).toBe("string");
    expect(typeof response.requestId).toBe("string");
  });
});
