import { describe, expect, it } from "vitest";
import { formatCompactDate, formatReadableDate } from "./dateFormat";

describe("date formatting utilities", () => {
  it("formats timestamps with a readable date and time", () => {
    expect(formatReadableDate("2026-06-13T12:00:00Z")).toMatch(
      /^Jun 13, 2026 at \d{1,2}:\d{2} (AM|PM)$/,
    );
  });

  it("can omit time for compact table and chart labels", () => {
    expect(formatReadableDate("2026-06-13T12:00:00Z", { includeTime: false })).toBe("Jun 13, 2026");
    expect(formatCompactDate("2026-06-13T12:00:00Z")).toBe("Jun 13");
  });

  it("uses fallbacks for empty or invalid dates", () => {
    expect(formatReadableDate(null)).toBe("Unknown date");
    expect(formatReadableDate("not-a-date", { fallback: "N/A" })).toBe("N/A");
  });
});
