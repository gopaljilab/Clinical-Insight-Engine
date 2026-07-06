import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Activity } from "lucide-react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders primary and secondary action labels", () => {
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: new URL("https://clinical.test/history"),
    });

    const html = renderToStaticMarkup(
      React.createElement(EmptyState, {
        icon: Activity,
        title: "No matching records",
        description: "Clear filters to return to the full list.",
        actionLabel: "Clear Filters",
        actionOnClick: vi.fn(),
        secondaryActionLabel: "Create Assessment",
        secondaryActionHref: "/dashboard",
      })
    );

    expect(html).toContain("No matching records");
    expect(html).toContain("Clear Filters");
    expect(html).toContain("Create Assessment");
    expect(html).toContain('href="/dashboard"');
  });
});
