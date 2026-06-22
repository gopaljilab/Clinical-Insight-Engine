import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("strips simple opening and closing tags", () => {
    const result = sanitizeHtml("<script>alert('xss')</script>");
    expect(result).toBe("alert('xss')");
  });

  it("handles nested tags", () => {
    const result = sanitizeHtml("<div><p>Clinical note</p></div>");
    expect(result).toBe("Clinical note");
  });

  it("handles unclosed tags", () => {
    const result = sanitizeHtml("some <b>bold text");
    expect(result).toBe("some bold text");
  });

  it("strips attributes from tags", () => {
    const result = sanitizeHtml('<a href="http://evil.com">link</a>');
    expect(result).toBe("link");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("returns plain text unchanged when no HTML tags present", () => {
    const result = sanitizeHtml("Patient name is John Doe, age 45.");
    expect(result).toBe("Patient name is John Doe, age 45.");
  });

  it("handles self-closing br tag", () => {
    expect(sanitizeHtml("line1<br/>line2")).toBe("line1line2");
    expect(sanitizeHtml("line1<br>line2")).toBe("line1line2");
  });

  it("handles img tag with src attribute", () => {
    const result = sanitizeHtml('<img src="http://evil.com/pixel.png" />');
    expect(result).toBe("");
  });

  it("handles multiple tags in a single string", () => {
    const result = sanitizeHtml("<b>Bold</b> and <i>italic</i> text");
    expect(result).toBe("Bold and italic text");
  });

  it("handles incomplete/malformed tag fragments", () => {
    expect(sanitizeHtml("<script")).toBe("<script");
    expect(sanitizeHtml("a < b")).toBe("a < b");
  });

  it("handles mixed content with numbers and special chars", () => {
    const result = sanitizeHtml("BMI: <strong>24.5</strong>, age: <em>45</em>");
    expect(result).toBe("BMI: 24.5, age: 45");
  });
});
