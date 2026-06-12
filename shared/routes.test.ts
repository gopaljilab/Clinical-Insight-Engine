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
  it("accepts the queued assessment response contract", () => {
    const parsed = api.assessments.create.responses[202].parse({
      message: "Assessment request accepted and is being processed.",
      jobId: "42",
    });

    expect(parsed.jobId).toBe("42");
  });

  it("rejects queued assessment responses without a job id", () => {
    const result = api.assessments.create.responses[202].safeParse({
      message: "Assessment request accepted and is being processed.",
    });

    expect(result.success).toBe(false);
  });

  it("accepts paginated assessment list metadata", () => {
    const parsed = api.assessments.list.responses[200].parse({
      data: [],
      nextCursor: null,
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    });

    expect(parsed.total).toBe(0);
    expect(parsed.nextCursor).toBeNull();
  });

  it("rejects malformed validation error responses", () => {
    const result = api.assessments.create.responses[400].safeParse({
      field: "age",
    });

    expect(result.success).toBe(false);
  });
});
