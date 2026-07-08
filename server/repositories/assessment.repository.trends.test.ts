import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the `where` clause passed into db.select().from(assessments).where(...)
// so we can assert on which filters were actually applied, without needing a
// real database connection.
let capturedWhere: any;

vi.mock("../db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn((where: any) => {
          capturedWhere = where;
          return {
            orderBy: vi.fn(() => Promise.resolve([])),
          };
        }),
      })),
    })),
  })),
}));

import { AssessmentRepository } from "./assessment.repository";

/** A drizzle `and(...)`/`eq(...)` SQL fragment serializes its column and
 * value references into `queryChunks`, so we can check for a given
 * column name + value pair without needing a live DB dialect to render SQL. */
function serializeWhere(where: any): string {
  const seen = new WeakSet();
  return JSON.stringify(where, (key, val) => {
    // Drizzle column objects hold a back-reference to their table (which in
    // turn holds all its columns), which is circular and irrelevant here —
    // we only need each column's own `name` field.
    if (key === "table") return undefined;
    if (typeof val === "object" && val !== null) {
      if (seen.has(val)) return undefined;
      seen.add(val);
    }
    return val;
  });
}

function whereReferencesColumn(where: any, columnName: string): boolean {
  return serializeWhere(where).includes(`"name":"${columnName}"`);
}

function whereReferencesColumnValue(where: any, columnName: string, value: string): boolean {
  const json = serializeWhere(where);
  return json.includes(`"name":"${columnName}"`) && json.includes(JSON.stringify(value));
}

describe("AssessmentRepository.getTrendsDashboardData — createdBy scoping", () => {
  let repo: AssessmentRepository;

  beforeEach(() => {
    capturedWhere = undefined;
    repo = new AssessmentRepository();
  });

  it("scopes the query by createdBy when provided", async () => {
    await repo.getTrendsDashboardData("John Doe", undefined, undefined, "provider-a@example.com");

    expect(whereReferencesColumnValue(capturedWhere, "created_by", "provider-a@example.com")).toBe(true);
    expect(whereReferencesColumnValue(capturedWhere, "patient_name", "John Doe")).toBe(true);
  });

  it("does not apply a createdBy filter when it is omitted (backward compatible)", async () => {
    await repo.getTrendsDashboardData("John Doe", undefined, undefined);

    expect(whereReferencesColumn(capturedWhere, "created_by")).toBe(false);
    expect(whereReferencesColumn(capturedWhere, "patient_name")).toBe(true);
  });
});