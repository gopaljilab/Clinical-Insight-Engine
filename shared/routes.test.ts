import { describe, expect, it } from "vitest";
import {
  RISK_CATEGORIES,
  buildUrl,
  api,
} from "./routes";

describe("RISK_CATEGORIES", () => {
  it("contains LOW, MODERATE, and HIGH", () => {
    expect(RISK_CATEGORIES).toContain("LOW");
    expect(RISK_CATEGORIES).toContain("MODERATE");
    expect(RISK_CATEGORIES).toContain("HIGH");
  });

  it("has exactly 3 entries", () => {
    expect(RISK_CATEGORIES).toHaveLength(3);
  });

  it("has exactly 3 entries", () => {
    expect(RISK_CATEGORIES).toHaveLength(3);
  });
});

describe("buildUrl", () => {
  it("replaces a single path parameter", () => {
    const result = buildUrl("/api/assessments/:id", { id: "42" });
    expect(result).toBe("/api/assessments/42");
  });

  it("replaces multiple path parameters", () => {
    const result = buildUrl("/api/patients/:patientId/assessments/:assessmentId", {
      patientId: "10",
      assessmentId: "99",
    });
    expect(result).toBe("/api/patients/10/assessments/99");
  });

  it("returns path unchanged when no params are provided", () => {
    const result = buildUrl("/api/assessments");
    expect(result).toBe("/api/assessments");
  });

  it("returns path unchanged when params object is empty", () => {
    const result = buildUrl("/api/assessments", {});
    expect(result).toBe("/api/assessments");
  });

  it("leaves path unchanged when params keys are not in path", () => {
    const result = buildUrl("/api/assessments", { patientId: "5" });
    expect(result).toBe("/api/assessments");
  });

  it("converts numeric params to strings in the path", () => {
    const result = buildUrl("/api/assessments/:id", { id: 123 });
    expect(result).toBe("/api/assessments/123");
  });

  it("handles string params with spaces", () => {
    const result = buildUrl("/api/patients/:name", { name: "John Doe" });
    expect(result).toBe("/api/patients/John Doe");
  });

  it("handles params with special URL characters", () => {
    // Note: buildUrl does not URL-encode — callers are responsible for encoding
    const result = buildUrl("/api/search/:query", { query: "test+query" });
    expect(result).toBe("/api/search/test+query");
  });

  it("replaces the first occurrence of each param key (single replace)", () => {
    // Note: buildUrl uses String.replace() which only replaces the first occurrence
    const result = buildUrl("/api/assessments/:id/similar/:id", { id: "5" });
    expect(result).toBe("/api/assessments/5/similar/:id");
  });

  it("handles boolean params", () => {
    const result = buildUrl("/api/flag/:active", { active: true });
    expect(result).toBe("/api/flag/true");
  });

  it("path is returned as-is when params are provided but no keys match", () => {
    const path = "/api/assessments/search";
    const result = buildUrl(path, { q: "diabetes" });
    expect(result).toBe("/api/assessments/search");
  });
});

describe("api.assessments schema shapes", () => {
  it("api.assessments.create defines POST /api/assessments", () => {
    expect(api.assessments.create.method).toBe("POST");
    expect(api.assessments.create.path).toBe("/api/assessments");
    expect(typeof api.assessments.create.input).toBe("object");
    expect(typeof api.assessments.create.responses).toBe("object");
    expect(api.assessments.create.responses[201]).toBeDefined();
    expect(api.assessments.create.responses[400]).toBeDefined();
  });

  it("api.assessments.list defines GET /api/assessments", () => {
    expect(api.assessments.list.method).toBe("GET");
    expect(api.assessments.list.path).toBe("/api/assessments");
  });

  it("api.assessments.search defines GET /api/assessments/search", () => {
    expect(api.assessments.search.method).toBe("GET");
    expect(api.assessments.search.path).toBe("/api/assessments/search");
  });

  it("api.assessments.getById defines GET /api/assessments/:id", () => {
    expect(api.assessments.getById.method).toBe("GET");
    expect(api.assessments.getById.path).toBe("/api/assessments/:id");
  });

  it("api.assessments.preview defines POST /api/assessments/preview", () => {
    expect(api.assessments.preview.method).toBe("POST");
    expect(api.assessments.preview.path).toBe("/api/assessments/preview");
  });

  it("api.assessments.simulate defines POST /api/assessments/simulate", () => {
    expect(api.assessments.simulate.method).toBe("POST");
    expect(api.assessments.simulate.path).toBe("/api/assessments/simulate");
  });

  it("api.assessments.whatIf defines POST /api/assessments/what-if", () => {
    expect(api.assessments.whatIf.method).toBe("POST");
    expect(api.assessments.whatIf.path).toBe("/api/assessments/what-if");
  });

  it("api.assessments.whatIfBatch defines POST /api/assessments/what-if/batch", () => {
    expect(api.assessments.whatIfBatch.method).toBe("POST");
    expect(api.assessments.whatIfBatch.path).toBe("/api/assessments/what-if/batch");
  });

  it("api.assessments.biomarkerAlerts defines GET /api/assessments/biomarker-alerts", () => {
    expect(api.assessments.biomarkerAlerts.method).toBe("GET");
    expect(api.assessments.biomarkerAlerts.path).toBe("/api/assessments/biomarker-alerts");
  });

  it("api.assessments.cohort.query defines GET /api/assessments/cohort", () => {
    expect(api.assessments.cohort.query.method).toBe("GET");
    expect(api.assessments.cohort.query.path).toBe("/api/assessments/cohort");
  });

  it("list endpoint has 200 response defined", () => {
    expect(api.assessments.list.responses[200]).toBeDefined();
  });
});

describe("Response type helpers", () => {
  it("AssessmentPreviewResponse has expected shape", () => {
    // Verify the type is inferable — structure check via schema
    const previewSchema = api.assessments.preview.responses[200];
    expect(typeof previewSchema.parse).toBe("function");
  });

  it("AssessmentSimulationResponse has expected shape", () => {
    const simSchema = api.assessments.simulate.responses[200];
    expect(typeof simSchema.parse).toBe("function");
  });
});
