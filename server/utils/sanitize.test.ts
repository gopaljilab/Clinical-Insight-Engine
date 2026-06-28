import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("returns string unchanged when no HTML tags present", () => {
    expect(sanitizeHtml("Hello, this is plain text.")).toBe(
      "Hello, this is plain text."
    );
  });

  it("removes a simple open tag", () => {
    expect(sanitizeHtml("Hello <b>world</b>")).toBe("Hello world");
  });

  it("removes nested HTML tags", () => {
    expect(sanitizeHtml("<p>Paragraph with <strong>nested</strong> text</p>")).toBe(
      "Paragraph with nested text"
    );
  });

  it("removes script tags", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("removes img tags with attributes", () => {
    expect(sanitizeHtml('Text before <img src="x" onerror="alert(1)"> text after')).toBe(
      "Text before  text after"
    );
  });

  it("removes multiple HTML-like patterns on same line", () => {
    expect(sanitizeHtml("<b>bold</b> and <i>italic</i> and <u>underline</u>")).toBe(
      "bold and italic and underline"
    );
  });

  it("handles string with only HTML tags", () => {
    expect(sanitizeHtml("<div></div>")).toBe("");
  });

  it("removes tag with special characters inside", () => {
    expect(sanitizeHtml("<span class='test' data-val='1'>content</span>")).toBe(
      "content"
    );
  });

  it("removes tags and keeps surrounding whitespace", () => {
    expect(sanitizeHtml("  <p>  spaced  </p>  ")).toBe("    spaced    ");
  });

  it("removes malformed unclosed tags", () => {
    expect(sanitizeHtml("Text <span>content")).toBe("Text content");
  });

  it("removes tags with no angle brackets inside", () => {
    expect(sanitizeHtml("Email: test@example.com and <b>bold</b>")).toBe(
      "Email: test@example.com and bold"
    );
  });
});
