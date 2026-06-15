import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button loading state", () => {
  it("disables the button and exposes busy state while loading", () => {
    const html = renderToStaticMarkup(
      React.createElement(Button, { isLoading: true, loadingText: "Saving..." }, "Save"),
    );

    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("aria-busy=\"true\"");
    expect(html).toContain("data-loading=\"true\"");
    expect(html).toContain("Saving...");
    expect(html).toContain("animate-spin");
  });

  it("preserves normal children when not loading", () => {
    const html = renderToStaticMarkup(React.createElement(Button, null, "Save"));

    expect(html).toContain(">Save</button>");
    expect(html).not.toContain("aria-busy");
    expect(html).not.toContain("data-loading");
  });
});
