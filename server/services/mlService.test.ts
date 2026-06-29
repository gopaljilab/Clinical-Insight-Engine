import { describe, expect, it, vi, beforeEach } from "vitest";

const mockExistsSync = vi.fn();

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: mockExistsSync,
  };
});

describe("getPythonExecutable", () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
  });

  it("returns .venv/bin/python when it exists on linux", async () => {
    mockExistsSync.mockImplementation((p: string) => p.includes(".venv"));
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    const { getPythonExecutable } = await import("./mlService");
    const result = getPythonExecutable();
    expect(result).toContain(".venv");
    expect(result).toContain("bin");
    expect(result).toContain("python");
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  });

  it("falls back to python3 when no venv exists on linux", async () => {
    mockExistsSync.mockReturnValue(false);
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    const { getPythonExecutable } = await import("./mlService");
    const result = getPythonExecutable();
    expect(result).toBe("python3");
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  });

  it("returns .venv/Scripts/python.exe when it exists on windows", async () => {
    mockExistsSync.mockImplementation((p: string) => p.includes(".venv"));
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    const { getPythonExecutable } = await import("./mlService");
    const result = getPythonExecutable();
    expect(result).toContain(".venv");
    expect(result).toContain("Scripts");
    expect(result).toContain("python.exe");
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  });

  it("falls back to python when no venv exists on windows", async () => {
    mockExistsSync.mockReturnValue(false);
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    const { getPythonExecutable } = await import("./mlService");
    const result = getPythonExecutable();
    expect(result).toBe("python");
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
  });
});
