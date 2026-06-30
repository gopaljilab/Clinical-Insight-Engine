import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("strips basic HTML tags", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("returns string unchanged when no tags present", () => {
    expect(sanitizeHtml("Hello World")).toBe("Hello World");
    expect(sanitizeHtml("No tags here")).toBe("No tags here");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("handles nested tags", () => {
    expect(sanitizeHtml("<div><p>Nested</p></div>")).toBe("Nested");
  });

  it("handles unclosed tags", () => {
    expect(sanitizeHtml("Text <b>bold")).toBe("Text bold");
  });

  it("handles special characters in HTML entities", () => {
    expect(sanitizeHtml("A &amp; B")).toBe("A &amp; B");
    expect(sanitizeHtml("5 > 3")).toBe("5 > 3");
    expect(sanitizeHtml("3 < 5")).toBe("3 < 5");
  });

  it("handles mixed content", () => {
    expect(sanitizeHtml("Hello <strong>World</strong>!")).toBe("Hello World!");
  });

  it("handles self-closing tags", () => {
    expect(sanitizeHtml("Line1<br/>Line2")).toBe("Line1Line2");
    expect(sanitizeHtml("HR<hr>below")).toBe("HRbelow");
  });
});
