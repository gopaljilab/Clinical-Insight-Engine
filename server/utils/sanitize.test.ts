import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("returns text unchanged when no HTML tags are present", () => {
    expect(sanitizeHtml("Hello world")).toBe("Hello world");
    expect(sanitizeHtml("Patient name: John Doe")).toBe("Patient name: John Doe");
  });

  it("strips a single HTML tag", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
    expect(sanitizeHtml("<b>Bold text</b>")).toBe("Bold text");
  });

  it("strips multiple HTML tags in a single string", () => {
    expect(sanitizeHtml("<p>First</p><p>Second</p>")).toBe("FirstSecond");
    expect(sanitizeHtml("<em>italic</em> and <strong>bold</strong>")).toBe("italic and bold");
  });

  it("strips nested HTML tags", () => {
    expect(sanitizeHtml("<div><span>nested</span></div>")).toBe("nested");
    expect(sanitizeHtml("<ul><li>item1</li><li>item2</li></ul>")).toBe("item1item2");
  });

  it("strips unclosed HTML tags", () => {
    expect(sanitizeHtml("text<br>more text")).toBe("textmore text");
    expect(sanitizeHtml("line1<hr>line2")).toBe("line1line2");
  });

  it("strips empty angle brackets as a tag", () => {
    expect(sanitizeHtml("before<>after")).toBe("beforeafter");
  });

  it("returns empty string for string with only HTML tags", () => {
    expect(sanitizeHtml("<div></div>")).toBe("");
    expect(sanitizeHtml("<span /><span/>")).toBe("");
  });

  it("handles empty string input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("handles whitespace-only input", () => {
    expect(sanitizeHtml("   ")).toBe("   ");
  });

  it("strips tags with attributes", () => {
    expect(sanitizeHtml('<a href="http://evil.com">link</a>')).toBe("link");
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe("");
  });

  it("strips tags with unicode characters", () => {
    expect(sanitizeHtml("Name: <b>Jorgeluis</b>")).toBe("Name: Jorgeluis");
    expect(sanitizeHtml("<p>Prix: 50 EUR</p>")).toBe("Prix: 50 EUR");
  });

  it("strips script tags and preserves content", () => {
    expect(sanitizeHtml('<script>document.cookie</script>')).toBe("document.cookie");
  });
});
