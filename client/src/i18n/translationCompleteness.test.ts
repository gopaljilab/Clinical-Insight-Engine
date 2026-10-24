import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import i18n from "./index";

const sourceRoot = path.resolve(process.cwd(), "client/src");

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(entryPath) : /\.[jt]sx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function getValue(source: Record<string, any>, key: string): unknown {
  return key.split(".").reduce<unknown>((value, segment) => {
    if (value === null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[segment];
  }, source);
}

describe("translation resources", () => {
  test("the browser entry point initializes i18next before rendering the app", () => {
    const entrypoint = fs.readFileSync(path.resolve(sourceRoot, "main.tsx"), "utf8");
    expect(entrypoint).toMatch(/import\s+["']\.\/i18n["']/);
  });

  test("all literal client translation keys resolve to English text", async () => {
    const en = await import("../locales/en/translation.json");
    const keys = new Set<string>();

    for (const file of sourceFiles(sourceRoot)) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(/\bt\(\s*["']([\w.]+)["']/g)) {
        keys.add(match[1]);
      }
    }

    const unresolved = [...keys].filter((key) => typeof getValue(en, key) !== "string");
    expect(unresolved).toEqual([]);
  });

  test("missing Spanish result strings fall back to English and interpolate values", () => {
    const spanish = i18n.getFixedT("es");
    expect(spanish("patientResult.present")).toBe("Present");
    expect(spanish("patientPresentation.targetBmi", { bmi: "24.0" })).toBe("Consider a BMI goal near 24.0");
  });
});
