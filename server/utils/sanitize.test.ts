import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("returns plain text unchanged", () => {
    expect(sanitizeHtml("Hello world")).toBe("Hello world");
  });

  it("strips opening and closing tags", () => {
    expect(sanitizeHtml("Hello <b>world</b>")).toBe("Hello world");
  });

  it("strips self-closing tags", () => {
    expect(sanitizeHtml("line1<br/>line2")).toBe("line1line2");
  });

  it("strips hr tags", () => {
    expect(sanitizeHtml("text<hr>more")).toBe("textmore");
  });

  it("strips nested tags", () => {
    expect(sanitizeHtml("<div><p>paragraph</p></div>")).toBe("paragraph");
  });

  it("strips tags with attributes", () => {
    expect(sanitizeHtml("<a href='https://evil.com'>link</a>")).toBe("link");
  });

  it("strips script tags content remains but tag removed", () => {
    expect(sanitizeHtml("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("returns empty string when input is only tags", () => {
    expect(sanitizeHtml("<><>")).toBe("");
  });

  it("handles mixed text and multiple tag types", () => {
    const input = "<p>Hello</p> <br/> <span style='color:red'>world</span>";
    // regex strips tags but whitespace between them is preserved
    expect(sanitizeHtml(input)).toBe("Hello  world");
  });

  it("handles unclosed tags", () => {
    expect(sanitizeHtml("text<strong>bold")).toBe("textbold");
  });

  it("handles img tag with src", () => {
    expect(sanitizeHtml("<img src='x' onerror='alert(1)'>")).toBe("");
  });
});
