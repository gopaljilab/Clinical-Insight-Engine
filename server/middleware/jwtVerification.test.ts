import { expect, test, describe } from "vitest";
import { extractBearerToken } from "./jwtVerification";

// Minimal mock for Request type (Express lowercases header keys to lowercase)
function mockReq(headers: Record<string, string | string[] | undefined>): any {
  return { headers };
}

describe("extractBearerToken", () => {
  test("returns token string for valid Bearer header", () => {
    const req = mockReq({ authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.test.signature" });
    const result = extractBearerToken(req);
    expect(result).toBe("eyJhbGciOiJIUzI1NiJ9.test.signature");
  });

  test("handles Bearer in lowercase", () => {
    const req = mockReq({ authorization: "bearer some.token.here" });
    const result = extractBearerToken(req);
    expect(result).toBe("some.token.here");
  });

  test("returns null when scheme is not lowercase bearer", () => {
    // Only "bearer" (case-insensitive) is accepted
    const req = mockReq({ authorization: "BeArEr token123" });
    const result = extractBearerToken(req);
    expect(result).toBeNull();
  });

  test("returns null when Authorization header is missing", () => {
    const req = mockReq({});
    const result = extractBearerToken(req);
    expect(result).toBeNull();
  });

  test("returns null when Authorization header is undefined", () => {
    const req = mockReq({ authorization: undefined });
    const result = extractBearerToken(req);
    expect(result).toBeNull();
  });

  test("returns null when Authorization header is empty string", () => {
    const req = mockReq({ authorization: "" });
    const result = extractBearerToken(req);
    expect(result).toBeNull();
  });

  test("returns null when scheme is not Bearer", () => {
    const req = mockReq({ authorization: "Basic dXNlcjpwYXNz" });
    const result = extractBearerToken(req);
    expect(result).toBeNull();
  });

  test("returns null when header has only Bearer without token", () => {
    const req = mockReq({ authorization: "Bearer" });
    const result = extractBearerToken(req);
    expect(result).toBeNull();
  });

  test("returns null when header has Bearer and empty token", () => {
    const req = mockReq({ authorization: "Bearer " });
    const result = extractBearerToken(req);
    expect(result).toBeNull();
  });

  test("returns null when header has extra parts (more than 2)", () => {
    const req = mockReq({ authorization: "Bearer token extra" });
    const result = extractBearerToken(req);
    expect(result).toBeNull();
  });

  test("returns null when token has no dot", () => {
    const req = mockReq({ authorization: "Bearer noDotToken" });
    const result = extractBearerToken(req);
    expect(result).toBeNull();
  });

  test("returns token when token has multiple dots", () => {
    const req = mockReq({ authorization: "Bearer a.b.c.d" });
    const result = extractBearerToken(req);
    expect(result).toBe("a.b.c.d");
  });

  test("returns null for Bearer with token containing whitespace", () => {
    const req = mockReq({ authorization: "Bearer token with space" });
    const result = extractBearerToken(req);
    // parts = ["Bearer", "token", "with", "space"]; length !== 2 => null
    expect(result).toBeNull();
  });
});
