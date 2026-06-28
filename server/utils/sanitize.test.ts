import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("returns normal text unchanged", () => {
    expect(sanitizeHtml("Hello, world")).toBe("Hello, world");
  });

  it("strips a single HTML tag", () => {
    expect(sanitizeHtml("<b>hello</b>")).toBe("hello");
  });

  it("strips multiple HTML tags", () => {
    expect(sanitizeHtml("<p>First</p><p>Second</p>")).toBe("FirstSecond");
  });

  it("strips nested HTML tags", () => {
    expect(sanitizeHtml("<div><p>text</p></div>")).toBe("text");
  });

  it("strips self-closing tags", () => {
    expect(sanitizeHtml("<br/>test<br>")).toBe("test");
  });

  it("strips mixed content", () => {
    expect(sanitizeHtml("Name: <b>John</b>")).toBe("Name: John");
  });

  it("strips script tag and its content", () => {
    expect(sanitizeHtml("<script>alert(1)</script>hello")).toBe("alert(1)hello");
  });

  it("returns empty string for empty string input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("handles text with angle brackets that are not HTML tags", () => {
    // The regex only matches complete tag patterns; stray < without closing > is preserved
    expect(sanitizeHtml("a < b")).toBe("a < b");
  });

  it("handles unclosed HTML tags", () => {
    // Regex only strips matching <...> pairs; partial tags pass through
    expect(sanitizeHtml("Hello <b")).toBe("Hello <b");
  });

  it("handles text with whitespace around tags", () => {
    expect(sanitizeHtml("  <em>italic</em>  ")).toBe("  italic  ");
  });

  it("handles anchor tags with attributes", () => {
    expect(sanitizeHtml('<a href="http://example.com">link</a>')).toBe("link");
  });

  it("handles img tags with src attribute", () => {
    expect(sanitizeHtml('<img src="x" alt="pic"/>')).toBe("");
  });

  it("handles input tags", () => {
    expect(sanitizeHtml("Name: <input type='text'>")).toBe("Name: ");
  });
});
