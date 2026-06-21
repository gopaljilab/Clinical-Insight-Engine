import { describe, it, expect } from "vitest";
import { encodeHtmlEntities, getSafeQueryParam } from "./safeQueryParams";

describe("encodeHtmlEntities", () => {
  it("encodes ampersand", () => {
    expect(encodeHtmlEntities("a&b")).toBe("a&amp;b");
  });

  it("encodes less than", () => {
    expect(encodeHtmlEntities("a<b")).toBe("a&lt;b");
  });

  it("encodes greater than", () => {
    expect(encodeHtmlEntities("a>b")).toBe("a&gt;b");
  });

  it("encodes double quote", () => {
    expect(encodeHtmlEntities('a"b')).toBe("a&quot;b");
  });

  it("encodes single quote", () => {
    expect(encodeHtmlEntities("a'b")).toBe("a&#39;b");
  });

  it("leaves plain text unchanged", () => {
    expect(encodeHtmlEntities("Hello World")).toBe("Hello World");
  });

  it("encodes mixed HTML content", () => {
    // encodeHtmlEntities encodes &, <, >, ", ' but leaves / unchanged
    expect(encodeHtmlEntities('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
  });
});

describe("getSafeQueryParam", () => {
  it("returns empty string for missing key", () => {
    const result = getSafeQueryParam("name=John", "age");
    expect(result).toBe("");
  });

  it("returns empty string for malformed query string", () => {
    const result = getSafeQueryParam("not a valid query", "name");
    expect(result).toBe("");
  });

  it("returns empty string for empty query string", () => {
    const result = getSafeQueryParam("", "name");
    expect(result).toBe("");
  });

  it("returns HTML-encoded value for existing key", () => {
    const result = getSafeQueryParam("name=John%20Doe", "name");
    expect(result).toBe("John Doe");
  });

  it("returns empty string for XSS payload in query value", () => {
    // <script> gets stripped by validateFilterInput -> ""
    const result = getSafeQueryParam("q=<script>alert(1)</script>", "q");
    expect(result).toBe("");
  });

  it("returns HTML-encoded value for SQL injection (validateFilterInput does not block SQL patterns)", () => {
    // validateFilterInput only blocks XSS patterns, not SQL injection.
    // SQL injection is blocked by validateSearchInput (different function).
    // The value gets validated by validateFilterInput (passes) then HTML-encoded.
    const result = getSafeQueryParam("q=' OR 1=1 --", "q");
    expect(result).toBe("&#39; OR 1=1 --");
  });
});
