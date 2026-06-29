import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("returns plain text unchanged", () => {
    expect(sanitizeHtml("Hello, world!")).toBe("Hello, world!");
  });

  it("removes a single HTML tag", () => {
    expect(sanitizeHtml("<b>bold</b>")).toBe("bold");
  });

  it("removes multiple HTML tags", () => {
    expect(sanitizeHtml("<p>Hello</p><p>World</p>")).toBe("HelloWorld");
  });

  it("removes nested HTML tags", () => {
    expect(sanitizeHtml("<div><span>nested</span></div>")).toBe("nested");
  });

  it("removes self-closing tags", () => {
    expect(sanitizeHtml("text<br/>more<br>text")).toBe("textmoretext");
  });

  it("removes tags with attributes", () => {
    expect(sanitizeHtml('<a href="http://evil.com" onclick="alert(1)">link</a>')).toBe("link");
  });

  it("removes script tags and their content", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>safe")).toBe("alert('xss')safe");
  });

  it("removes style tags and their content", () => {
    expect(sanitizeHtml("<style>body{}</style>plain")).toBe("body{}plain");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("removes comment tags", () => {
    expect(sanitizeHtml("before<!-- comment -->after")).toBe("beforeafter");
  });

  it("removes img tags", () => {
    expect(sanitizeHtml("avatar: <img src='x' onerror='evil()'/>")).toBe("avatar: ");
  });

  it("handles text with angle brackets that are not valid HTML tags", () => {
    // The regex matches <...> where ... contains no >. Standalone < without matching > is preserved.
    expect(sanitizeHtml("5 < 10")).toBe("5 < 10"); // no > to close the tag
    expect(sanitizeHtml("a > b")).toBe("a > b");   // no opening < at all
  });
});
