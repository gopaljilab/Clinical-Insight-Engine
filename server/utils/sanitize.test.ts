import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("strips simple HTML tags", () => {
    expect(sanitizeHtml("<b>bold</b>")).toBe("bold");
  });

  it("strips nested tags", () => {
    expect(sanitizeHtml("<div><p>Hello <strong>World</strong></p></div>")).toBe(
      "Hello World"
    );
  });

  it("strips script tags", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("strips attributes from tags", () => {
    expect(sanitizeHtml('<a href="https://evil.com">link</a>')).toBe("link");
  });

  it("returns input unchanged when no HTML tags present", () => {
    expect(sanitizeHtml("Hello World")).toBe("Hello World");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("handles malformed HTML gracefully", () => {
    // Opening tags are stripped; closing tags without matching openers
    // are also stripped by the simple regex (consistent XSS prevention)
    expect(sanitizeHtml("<unclosed>text")).toBe("text");
    expect(sanitizeHtml("text</unclosed>")).toBe("text");
  });

  it("strips multiple tag types in a single string", () => {
    expect(sanitizeHtml("Hello <b>World</b> and <i>Friends</i>")).toBe(
      "Hello World and Friends"
    );
  });
});
