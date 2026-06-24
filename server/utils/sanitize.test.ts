import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  describe("basic tag stripping", () => {
    it("strips opening and closing script tags", () => {
      expect(sanitizeHtml("<script>alert(1)</script>")).toBe("alert(1)");
    });

    it("strips self-closing br tag", () => {
      expect(sanitizeHtml("line1<br/>line2")).toBe("line1line2");
    });

    it("strips self-closing hr tag", () => {
      expect(sanitizeHtml("before<hr/>after")).toBe("beforeafter");
    });

    it("strips div tags", () => {
      expect(sanitizeHtml("<div>content</div>")).toBe("content");
    });

    it("strips span tags", () => {
      expect(sanitizeHtml("<span>text</span>")).toBe("text");
    });

    it("strips img tag with src attribute", () => {
      expect(sanitizeHtml('<img src="https://evil.com/x.png"/>')).toBe("");
    });

    it("strips anchor tags", () => {
      expect(sanitizeHtml('<a href="https://evil.com">click</a>')).toBe("click");
    });

    it("strips onerror attribute content", () => {
      expect(sanitizeHtml('<img src=x onerror="alert(1)"/>')).toBe("");
    });
  });

  describe("nested tags", () => {
    it("strips nested p and strong tags", () => {
      expect(sanitizeHtml("<p><strong>bold text</strong></p>")).toBe("bold text");
    });

    it("strips deeply nested tags", () => {
      expect(
        sanitizeHtml("<div><ul><li>item1</li><li>item2</li></ul></div>")
      ).toBe("item1item2");
    });

    it("strips table structure tags", () => {
      expect(
        sanitizeHtml("<table><tr><td>cell</td></tr></table>")
      ).toBe("cell");
    });
  });

  describe("unclosed tags", () => {
    it("handles unclosed opening tag", () => {
      expect(sanitizeHtml("<div>text")).toBe("text");
    });

    it("handles stray closing tag", () => {
      expect(sanitizeHtml("text</div>")).toBe("text");
    });

    it("handles multiple unclosed tags", () => {
      expect(sanitizeHtml("<p><p><p>text")).toBe("text");
    });
  });

  describe("plain text and edge cases", () => {
    it("returns empty string unchanged", () => {
      expect(sanitizeHtml("")).toBe("");
    });

    it("returns plain text without tags unchanged", () => {
      expect(sanitizeHtml("hello world")).toBe("hello world");
    });

    it("preserves whitespace outside tags", () => {
      expect(sanitizeHtml("  hello  world  ")).toBe("  hello  world  ");
    });

    it("preserves newlines outside tags", () => {
      expect(sanitizeHtml("line1\nline2")).toBe("line1\nline2");
    });

    it("handles text with angle brackets that are not tags", () => {
      // < and > that don't form tags remain in output
      expect(sanitizeHtml("a < b")).toBe("a < b");
    });
  });

  describe("multiple occurrences", () => {
    it("strips all script tags", () => {
      expect(
        sanitizeHtml("<script>one</script>text<script>two</script>")
      ).toBe("onetexttwo");
    });

    it("strips all div tags", () => {
      expect(
        sanitizeHtml("<div>a</div><div>b</div><div>c</div>")
      ).toBe("abc");
    });
  });

  describe("svg and special tags", () => {
    it("strips svg tags", () => {
      expect(sanitizeHtml("<svg onload=alert(1)>")).toBe("");
    });

    it("strips iframe tags", () => {
      expect(sanitizeHtml('<iframe src="https://evil.com"></iframe>')).toBe("");
    });
  });
});
