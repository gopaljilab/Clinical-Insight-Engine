import { describe, expect, it, vi, beforeEach } from "vitest";
import { safeExecFile, safeExecML } from "./exec";

const mockExecFile = vi.hoisted(() => vi.fn((file, args, opts, cb) => {
  if (typeof opts === "function") {
    cb = opts;
    opts = undefined;
  }
  if (typeof cb === "function") {
    cb(null, "stdout result", "stderr result");
  }
  return {} as any;
}));

vi.mock("child_process", () => ({
  execFile: mockExecFile,
  spawn: vi.fn(),
  ChildProcess: class {},
}));

describe("safeExecFile validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows python3 with valid script and command", () => {
    expect(() =>
      safeExecFile("python3", ["analyze.py", "predict_file", "data.csv"])
    ).not.toThrow();
  });

  it("allows python with valid script and command", () => {
    expect(() =>
      safeExecFile("python", ["analyze.py", "train", "model.csv"])
    ).not.toThrow();
  });

  it("allows python.exe with valid script and command", () => {
    expect(() =>
      safeExecFile("python.exe", ["analyze.py", "predict_file", "data.csv"])
    ).not.toThrow();
  });

  it("rejects non-Python executables", () => {
    expect(() =>
      safeExecFile("bash", ["script.sh", "arg1"])
    ).toThrow("[Security] Unauthorized executable: bash");
  });

  it("rejects node as executable", () => {
    expect(() =>
      safeExecFile("node", ["server.js"])
    ).toThrow("[Security] Unauthorized executable: node");
  });

  it("rejects missing arguments (fewer than 2)", () => {
    expect(() =>
      safeExecFile("python3", ["analyze.py"])
    ).toThrow("[Security] Missing arguments for ML script execution.");
  });

  it("rejects empty args array", () => {
    expect(() =>
      safeExecFile("python3", [])
    ).toThrow("[Security] Missing arguments for ML script execution.");
  });

  it("rejects unauthorized script names", () => {
    expect(() =>
      safeExecFile("python3", ["evil.py", "predict_file"])
    ).toThrow("[Security] Unauthorized script execution: evil.py");
  });

  it("rejects path traversal in script name", () => {
    expect(() =>
      safeExecFile("python3", ["/etc/evil.py", "predict_file"])
    ).toThrow("[Security] Unauthorized script execution: evil.py");
  });

  it("rejects unauthorized ML commands", () => {
    expect(() =>
      safeExecFile("python3", ["analyze.py", "delete_all"])
    ).toThrow("[Security] Unauthorized ML command: delete_all");
  });

  it("rejects flag injection in arguments", () => {
    expect(() =>
      safeExecFile("python3", ["analyze.py", "predict_file", "--help"])
    ).toThrow("[Security] Argument injection detected. Flags are not permitted: --help");
  });

  it("rejects single-dash flag injection", () => {
    expect(() =>
      safeExecFile("python3", ["analyze.py", "predict_file", "-e", "os.system('rm -rf /')"])
    ).toThrow("[Security] Argument injection detected. Flags are not permitted: -e");
  });

  it("passes valid arguments through to cpExecFile", () => {
    safeExecFile("python3", ["analyze.py", "predict_file", "input.csv"]);
    expect(mockExecFile).toHaveBeenCalledTimes(1);
  });
});

describe("safeExecML", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves with stdout and stderr on success", async () => {
    const result = await safeExecML("python3", ["analyze.py", "predict_file", "data.csv"]);
    expect(result).toEqual({ stdout: "stdout result", stderr: "stderr result" });
  });

  it("rejects when cpExecFile returns an error", async () => {
    mockExecFile.mockImplementationOnce(
      (file, args, opts, cb) => {
        if (typeof opts === "function") {
          cb = opts;
          opts = undefined;
        }
        if (typeof cb === "function") {
          cb(new Error("exec failed"), "", "");
        }
        return {} as any;
      }
    );
    await expect(
      safeExecML("python3", ["analyze.py", "predict_file", "data.csv"])
    ).rejects.toThrow("exec failed");
  });

  it("uses default maxBuffer of 10MB", async () => {
    await safeExecML("python3", ["analyze.py", "predict_file", "data.csv"]);
    expect(mockExecFile).toHaveBeenCalledWith(
      "python3",
      ["analyze.py", "predict_file", "data.csv"],
      expect.objectContaining({ maxBuffer: 1024 * 1024 * 10 }),
      expect.any(Function)
    );
  });
});
