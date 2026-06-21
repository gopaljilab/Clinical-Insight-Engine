import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("strips script tags and their content", () => {
    const result = sanitizeHtml("<script>alert(1)</script>");
    expect(result).toBe("alert(1)");
  });

  it("strips partial HTML tags", () => {
    const result = sanitizeHtml("Hello <b>World</b>");
    expect(result).toBe("Hello World");
  });

  it("returns plain text unchanged", () => {
    const result = sanitizeHtml("Hello World");
    expect(result).toBe("Hello World");
  });

  it("returns empty string for empty input", () => {
    const result = sanitizeHtml("");
    expect(result).toBe("");
  });

  it("strips nested tags", () => {
    const result = sanitizeHtml("<div><p>Nested <span>text</span></p></div>");
    expect(result).toBe("Nested text");
  });

  it("strips self-closing tags", () => {
    const result = sanitizeHtml("Image: <img src=x onerror=alert(1)> done");
    expect(result).toBe("Image:  done");
  });

  it("strips tags with attributes", () => {
    const result = sanitizeHtml('<a href="https://evil.com" onclick="alert(1)">click</a>');
    expect(result).toBe("click");
  });
});
