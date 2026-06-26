import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("strips simple script tags", () => {
    expect(sanitizeHtml("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("strips anchor tags with attributes", () => {
    expect(sanitizeHtml('<a href="https://evil.com">Click here</a>')).toBe("Click here");
  });

  it("strips nested tags", () => {
    expect(sanitizeHtml("<div><p>Hello <strong>World</strong></p></div>")).toBe("Hello World");
  });

  it("strips self-closing tags", () => {
    expect(sanitizeHtml("Text<br/>More text<hr>End")).toBe("TextMore textEnd");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("returns input unchanged when no HTML tags present", () => {
    expect(sanitizeHtml("Plain clinical note text")).toBe("Plain clinical note text");
  });

  it("strips multiple tags and preserves text between them", () => {
    expect(sanitizeHtml("Start<tag>Middle</tag>End")).toBe("StartMiddleEnd");
  });

  it("handles strings with only opening tags", () => {
    expect(sanitizeHtml("<div>Text without close")).toBe("Text without close");
  });

  it("removes img tags with event handlers", () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe("");
  });

  it("handles mixed plain text and HTML", () => {
    const input = "Patient name: <b>John Doe</b>, DOB: 01/01/1980";
    expect(sanitizeHtml(input)).toBe("Patient name: John Doe, DOB: 01/01/1980");
  });
});
