import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("removes simple HTML tags", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("returns plain text unchanged", () => {
    expect(sanitizeHtml("Hello, World!")).toBe("Hello, World!");
  });

  it("removes anchor tags and preserves link text", () => {
    expect(sanitizeHtml('<a href="http://evil.com">Click here</a>')).toBe("Click here");
  });

  it("removes img tags", () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe("");
  });

  it("handles nested HTML tags", () => {
    expect(sanitizeHtml("<div><p>Paragraph <strong>text</strong></p></div>")).toBe(
      "Paragraph text"
    );
  });

  it("handles empty string", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("handles self-closing tags", () => {
    expect(sanitizeHtml("Line 1<br/>Line 2<hr/>")).toBe("Line 1Line 2");
  });

  it("handles XSS event handlers", () => {
    expect(sanitizeHtml('<img onload="alert(document.cookie)">')).toBe("");
    expect(sanitizeHtml('<div onmouseover="alert(1)">Hover me</div>')).toBe("Hover me");
  });

  it("handles unclosed tags", () => {
    expect(sanitizeHtml("<p>Unclosed")).toBe("Unclosed");
  });
});
