import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) =>
    React.createElement("div", { className: `animate-pulse ${className ?? ""}`, "data-testid": "skeleton" }),
}));

import { SkeletonCard, SkeletonTable, SkeletonChart, SkeletonText } from "./LoadingSkeleton";

describe("SkeletonCard", () => {
  it("renders fields with accessible loading semantics", () => {
    const html = renderToStaticMarkup(React.createElement(SkeletonCard));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading content"');
  });

  it("accepts custom count prop", () => {
    const html = renderToStaticMarkup(React.createElement(SkeletonCard, { count: 5 }));
    const matches = html.match(/data-testid="skeleton"/g);
    expect(matches).toHaveLength(15);
  });
});

describe("SkeletonTable", () => {
  it("renders table skeleton with rows and columns", () => {
    const html = renderToStaticMarkup(React.createElement(SkeletonTable));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading table"');
  });

  it("renders custom rows and columns", () => {
    const html = renderToStaticMarkup(React.createElement(SkeletonTable, { rows: 3, columns: 4 }));
    const headerCells = (html.match(/<div class="flex gap-4">[\s\S]*?<\/div>/g) ?? []).length;
    expect(headerCells).toBeGreaterThan(0);
  });
});

describe("SkeletonChart", () => {
  it("renders chart skeleton with bars", () => {
    const html = renderToStaticMarkup(React.createElement(SkeletonChart));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading chart"');
    expect(html).toContain("rounded-b-none");
  });
});

describe("SkeletonText", () => {
  it("renders text skeleton with lines", () => {
    const html = renderToStaticMarkup(React.createElement(SkeletonText));
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-label="Loading text"');
  });

  it("renders correct number of lines", () => {
    const html = renderToStaticMarkup(React.createElement(SkeletonText, { lines: 4 }));
    const skeletonElements = html.match(/data-testid="skeleton"/g);
    expect(skeletonElements).toHaveLength(4);
  });
});
