import { describe, expect, it, vi } from "vitest";

const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: mockExecFile,
}));

import { safeExecFile, safeExecML } from "./exec";

describe("validateArgs (via safeExecFile)", () => {
  it("accepts python3 with allowed script and command", () => {
    mockExecFile.mockImplementation((f, a, o, cb) => cb(null, "", ""));
    expect(() => {
      safeExecFile("python3", ["analyze.py", "predict_file", "data.csv"], {}, () => {});
    }).not.toThrow();
  });

  it("accepts python.exe with allowed script and command", () => {
    mockExecFile.mockImplementation((f, a, o, cb) => cb(null, "", ""));
    expect(() => {
      safeExecFile("python.exe", ["analyze.py", "train", "model.pkl"], {}, () => {});
    }).not.toThrow();
  });

  it("rejects non-Python executables", () => {
    expect(() => {
      safeExecFile("node", ["script.js"], {}, () => {});
    }).toThrow("Unauthorized executable");
  });

  it("rejects shell executables", () => {
    expect(() => {
      safeExecFile("/bin/bash", ["-c", "ls"], {}, () => {});
    }).toThrow("Unauthorized executable");
  });

  it("rejects empty/minimal args", () => {
    expect(() => {
      safeExecFile("python3", [], {}, () => {});
    }).toThrow("Missing arguments");
  });

  it("rejects disallowed script names", () => {
    expect(() => {
      safeExecFile("python3", ["evil.py", "predict_file"], {}, () => {});
    }).toThrow("Unauthorized script execution");
  });

  it("rejects disallowed commands", () => {
    expect(() => {
      safeExecFile("python3", ["analyze.py", "delete_all"], {}, () => {});
    }).toThrow("Unauthorized ML command");
  });

  it("rejects argument flags (--style)", () => {
    expect(() => {
      safeExecFile("python3", ["analyze.py", "predict_file", "--verbose"], {}, () => {});
    }).toThrow("Argument injection detected");
  });

  it("rejects negative-style flags (-n)", () => {
    expect(() => {
      safeExecFile("python3", ["analyze.py", "predict_file", "-e"], {}, () => {});
    }).toThrow("Argument injection detected");
  });
});

describe("safeExecML", () => {
  it("resolves with stdout and stderr on successful execution", async () => {
    mockExecFile.mockImplementation((f, a, o, cb) => cb(null, "prediction: 0.42", ""));
    const result = await safeExecML("python3", [
      "analyze.py",
      "predict_file",
      "data.csv",
    ]);
    expect(result.stdout).toBe("prediction: 0.42");
    expect(result.stderr).toBe("");
  });

  it("rejects when exec returns an error", async () => {
    const fakeError = new Error("script not found");
    mockExecFile.mockImplementation((f, a, o, cb) => cb(fakeError, "", ""));
    await expect(
      safeExecML("python3", ["analyze.py", "predict_file", "data.csv"]),
    ).rejects.toThrow("script not found");
  });
});
