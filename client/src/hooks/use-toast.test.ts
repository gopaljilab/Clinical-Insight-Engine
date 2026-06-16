import { describe, expect, it } from "vitest";
import { getToastDuration } from "./use-toast";

describe("getToastDuration", () => {
  it("uses a short duration for success/default toasts", () => {
    expect(getToastDuration({ title: "Saved" })).toBe(3000);
    expect(getToastDuration({ title: "Saved", severity: "success" })).toBe(3000);
  });

  it("keeps warnings and informational messages visible longer", () => {
    expect(getToastDuration({ title: "Review", severity: "warning" })).toBe(5000);
    expect(getToastDuration({ title: "Heads up", severity: "info" })).toBe(5000);
  });

  it("keeps destructive error toasts visible long enough to read", () => {
    expect(getToastDuration({ title: "Failed", variant: "destructive" })).toBe(7000);
    expect(getToastDuration({ title: "Failed", severity: "error" })).toBe(7000);
  });

  it("preserves caller-provided duration overrides", () => {
    expect(getToastDuration({ title: "Custom", duration: 9000 })).toBe(9000);
  });
});
