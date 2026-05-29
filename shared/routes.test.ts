import { describe, expect, it } from "vitest";
import { buildUrl } from "./routes";

describe("buildUrl", () => {
  it("returns the path unchanged when no params are provided", () => {
    expect(buildUrl("/api/assessments")).toBe("/api/assessments");
  });

  it("replaces path parameter placeholders with string values", () => {
    expect(buildUrl("/api/assessments/:id", { id: "42" })).toBe(
      "/api/assessments/42",
    );
  });

  it("coerces numeric parameter values to strings", () => {
    expect(buildUrl("/api/assessments/:id", { id: 7 })).toBe(
      "/api/assessments/7",
    );
  });
});
