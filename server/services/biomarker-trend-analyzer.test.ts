import { expect, test, describe } from "vitest";
import { analyzeBiomarkerTrends } from "./biomarker-trend-analyzer";

describe("biomarker-trend-analyzer", () => {
  test("detects increasing HbA1c trend over 3+ assessments (warning)", () => {
    const alerts = analyzeBiomarkerTrends({
      assessments: [
        { hba1cLevel: "5.0" as any, createdAt: new Date("2023-01-01") } as any,
        { hba1cLevel: "5.5" as any, createdAt: new Date("2023-02-01") } as any,
        { hba1cLevel: "6.0" as any, createdAt: new Date("2023-03-01") } as any,
        { hba1cLevel: "6.5" as any, createdAt: new Date("2023-04-01") } as any,
      ],
    });

    const hba1cAlert = alerts.find(a => a.biomarker === "HbA1c");
    expect(hba1cAlert).toBeDefined();
    expect(hba1cAlert?.trend).toBe("increasing");
    expect(hba1cAlert?.severity).toBe("warning");
  });

  test("detects increasing HbA1c trend over 2 assessments (info)", () => {
    const alerts = analyzeBiomarkerTrends({
      assessments: [
        { hba1cLevel: "5.0" as any, createdAt: new Date("2023-01-01") } as any,
        { hba1cLevel: "5.5" as any, createdAt: new Date("2023-02-01") } as any,
        { hba1cLevel: "6.0" as any, createdAt: new Date("2023-03-01") } as any,
      ],
    });

    const hba1cAlert = alerts.find(a => a.biomarker === "HbA1c");
    expect(hba1cAlert).toBeDefined();
    expect(hba1cAlert?.trend).toBe("increasing");
    expect(hba1cAlert?.severity).toBe("info");
  });

  test("returns no alerts for stable or fluctuating values", () => {
    const alerts = analyzeBiomarkerTrends({
      assessments: [
        { bmi: "25" as any, createdAt: new Date("2023-01-01") } as any,
        { bmi: "26" as any, createdAt: new Date("2023-02-01") } as any,
        { bmi: "25" as any, createdAt: new Date("2023-03-01") } as any,
        { bmi: "26" as any, createdAt: new Date("2023-04-01") } as any,
      ],
    });
    expect(alerts).toHaveLength(0);
  });
});
