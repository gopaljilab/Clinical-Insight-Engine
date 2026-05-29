import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("client/index.html", () => {
  it("defines a document title for tabs, bookmarks, and screen readers", () => {
    const htmlPath = path.resolve(import.meta.dirname, "../client/index.html");
    const html = readFileSync(htmlPath, "utf-8");

    expect(html).toMatch(
      /<title>\s*Clinical Insight Engine\s*<\/title>/i,
    );
  });
});
