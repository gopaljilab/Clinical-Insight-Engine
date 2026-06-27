import { describe, it, expect, vi, beforeEach } from "vitest";
import { safeExecFile, safeExecML } from "./exec";

// Mock child_process to prevent actual subprocess spawning
vi.mock("child_process", () => {
  const mockExecFile = vi.fn();
  return { execFile: mockExecFile };
});

describe("safeExecFile security guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executable validation", () => {
    it("throws on /bin/sh as unauthorized executable", () => {
      expect(() => {
        safeExecFile("/bin/sh", ["cmd", "ls"]);
      }).toThrow("[Security] Unauthorized executable");
    });

    it("throws on node as unauthorized executable", () => {
      expect(() => {
        safeExecFile("node", ["script.js", "run"]);
      }).toThrow("[Security] Unauthorized executable");
    });

    it("accepts absolute path ending in python", () => {
      expect(() => {
        safeExecFile("/usr/bin/python", ["analyze.py", "predict_file", "data.csv"]);
      }).not.toThrow();
    });
  });

  describe("script allowlist", () => {
    it("throws on unauthorized script not in ALLOWED_SCRIPTS", () => {
      expect(() => {
        safeExecFile("python", ["malicious.py", "run"]);
      }).toThrow("[Security] Unauthorized script execution");
    });

    it("accepts analyze.py as allowed script", () => {
      expect(() => {
        safeExecFile("python", ["analyze.py", "predict_file", "data.csv"]);
      }).not.toThrow();
    });

    it("accepts analyze.py with python3 executable", () => {
      expect(() => {
        safeExecFile("python3", ["analyze.py", "train", "model.pkl"]);
      }).not.toThrow();
    });
  });

  describe("command allowlist", () => {
    it("throws on unauthorized command not in ALLOWED_COMMANDS", () => {
      expect(() => {
        safeExecFile("python", ["analyze.py", "delete", "file.csv"]);
      }).toThrow("[Security] Unauthorized ML command");
    });

    it("accepts predict_file as allowed command", () => {
      expect(() => {
        safeExecFile("python", ["analyze.py", "predict_file", "data.csv"]);
      }).not.toThrow();
    });

    it("accepts train as allowed command", () => {
      expect(() => {
        safeExecFile("python3", ["analyze.py", "train", "model.pkl"]);
      }).not.toThrow();
    });
  });

  describe("argument injection detection", () => {
    it("throws on flag injection starting with - at position 2+", () => {
      expect(() => {
        safeExecFile("python", ["analyze.py", "predict_file", "--help"]);
      }).toThrow("[Security] Argument injection detected");
    });

    it("throws on -f flag injection", () => {
      expect(() => {
        safeExecFile("python", ["analyze.py", "predict_file", "-e", "rm -rf"]);
      }).toThrow("[Security] Argument injection detected");
    });

    it("allows path traversal in argument (not a flag)", () => {
      // validateArgs only blocks flag injection (- prefix), not path traversal
      expect(() => {
        safeExecFile("python", ["analyze.py", "predict_file", "../../etc/passwd"]);
      }).not.toThrow();
    });
  });

  describe("missing arguments", () => {
    it("throws when args array has fewer than 2 elements", () => {
      expect(() => {
        safeExecFile("python", ["analyze.py"]);
      }).toThrow("[Security] Missing arguments");
    });

    it("throws when args is empty array", () => {
      expect(() => {
        safeExecFile("python", []);
      }).toThrow("[Security] Missing arguments");
    });
  });
});

describe("safeExecML security guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized executable via safeExecML", async () => {
    await expect(safeExecML("node", ["script.js", "run"])).rejects.toThrow(
      "[Security] Unauthorized executable"
    );
  });

  it("rejects unauthorized script via safeExecML", async () => {
    await expect(safeExecML("python", ["malicious.py", "run"])).rejects.toThrow(
      "[Security] Unauthorized script execution"
    );
  });

  it("rejects unauthorized command via safeExecML", async () => {
    await expect(safeExecML("python", ["analyze.py", "delete"])).rejects.toThrow(
      "[Security] Unauthorized ML command"
    );
  });

  it("rejects argument injection via safeExecML", async () => {
    await expect(
      safeExecML("python", ["analyze.py", "predict_file", "--version"])
    ).rejects.toThrow("[Security] Argument injection detected");
  });
});
