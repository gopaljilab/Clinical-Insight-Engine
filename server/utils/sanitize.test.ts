import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(sanitizeHtml("Hello World")).toBe("Hello World");
    expect(sanitizeHtml("Patient has diabetes")).toBe("Patient has diabetes");
  });

  it("removes script tags", () => {
    expect(sanitizeHtml("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("removes div tags", () => {
    expect(sanitizeHtml("<div>content</div>")).toBe("content");
  });

  it("removes span tags", () => {
    expect(sanitizeHtml("<span>text</span>")).toBe("text");
  });

  it("removes img tags completely", () => {
    expect(sanitizeHtml('<img src="x" onerror="alert(1)">')).toBe("");
  });

  it("removes iframe tags", () => {
    expect(sanitizeHtml("<iframe src='http://evil.com'></iframe>")).toBe(
      ""
    );
  });

  it("removes nested tags", () => {
    expect(sanitizeHtml("<div><p>paragraph</p></div>")).toBe("paragraph");
  });

  it("removes self-closing tags", () => {
    expect(sanitizeHtml("text<br/>more text")).toBe("textmore text");
    expect(sanitizeHtml("text<br>more text")).toBe("textmore text");
  });

  it("removes tags with attributes", () => {
    expect(sanitizeHtml('<a href="http://evil.com" onclick="evil()">link</a>')).toBe(
      "link"
    );
  });

  it("removes multiple tags in text", () => {
    const input = "Hello <b>world</b> and <i>friends</i>";
    expect(sanitizeHtml(input)).toBe("Hello world and friends");
  });

  it("handles HTML entities that are not tags", () => {
    expect(sanitizeHtml("A & B")).toBe("A & B");
    expect(sanitizeHtml("5 &lt; 10")).toBe("5 &lt; 10");
  });

  it("handles mixed safe and unsafe content", () => {
    const input = "Patient note: <script>stealCookies()</script> — resolved.";
    expect(sanitizeHtml(input)).toBe("Patient note: stealCookies() — resolved.");
  });
});
