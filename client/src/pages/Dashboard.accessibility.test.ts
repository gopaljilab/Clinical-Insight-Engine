import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = fs.readFileSync(
  path.resolve(__dirname, "Dashboard.tsx"),
  "utf8",
);

describe("assessment form guidance", () => {
  it("adds unit-aware placeholders for clinical input fields", () => {
    expect(dashboardSource).toContain('placeholder="e.g. 45 years"');
    expect(dashboardSource).toContain('placeholder="e.g. 24.5 kg/m²"');
    expect(dashboardSource).toContain('placeholder="e.g. 5.7%"');
    expect(dashboardSource).toContain('placeholder="e.g. 140 mg/dL"');
  });

  it("connects assessment fields to accessible guidance text", () => {
    for (const id of [
      "patientName-guidance",
      "age-guidance",
      "bmi-guidance",
      "hba1cLevel-guidance",
      "bloodGlucoseLevel-guidance",
    ]) {
      expect(dashboardSource).toContain(`aria-describedby="${id}"`);
      expect(dashboardSource).toContain(`id="${id}"`);
    }
  });
});
