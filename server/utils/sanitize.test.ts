import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("strips HTML tags from a string", () => {
    expect(sanitizeHtml("<p>Hello</p>")).toBe("Hello");
  });

  it("strips script tags completely", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("strips nested tags", () => {
    expect(sanitizeHtml("<div><strong>Bold</strong> and <em>italic</em></div>")).toBe(
      "Bold and italic"
    );
  });

  it("returns the original string when no tags are present", () => {
    expect(sanitizeHtml("Plain text without tags")).toBe("Plain text without tags");
  });

  it("handles self-closing tags", () => {
    // <br/> is matched by <[^>]*> and removed
    expect(sanitizeHtml("Hello<br/>World")).toBe("HelloWorld");
  });

  it("handles tags with attributes", () => {
    expect(sanitizeHtml('<a href="http://evil.com">Click</a>')).toBe("Click");
  });

  it("handles multiple tags in sequence", () => {
    expect(sanitizeHtml("<h1>Title</h1><p>Para</p>")).toBe("TitlePara");
  });

  it("handles deeply nested tags", () => {
    expect(sanitizeHtml("<div><span><em>italic text</em></span></div>")).toBe("italic text");
  });

  it("returns empty string when input is only HTML tags", () => {
    expect(sanitizeHtml("<div></div>")).toBe("");
  });

  it("handles malformed tags", () => {
    expect(sanitizeHtml("Text<broken")).toBe("Text<broken");
  });

  it("handles angle brackets in content", () => {
    // < inside a tag attribute might leave things, but plain text is preserved
    expect(sanitizeHtml("a < b")).toBe("a < b");
  });
});
