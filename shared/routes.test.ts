import { describe, expect, it } from "vitest";
import { api, buildUrl } from "./routes";

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

describe("api route contracts", () => {
  it("accepts queued assessment responses with a support request id", () => {
    const parsed = api.assessments.create.responses[202].parse({
      message: "Assessment request accepted and is being processed.",
      jobId: "42",
      requestId: "req-123",
    });

    expect(parsed.requestId).toBe("req-123");
  });

  it("rejects queued assessment responses without a job id", () => {
    const result = api.assessments.create.responses[202].safeParse({
      message: "Assessment request accepted and is being processed.",
      requestId: "req-123",
    });

    expect(result.success).toBe(false);
  });
});
