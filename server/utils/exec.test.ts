import { describe, expect, it } from "vitest";
import { safeExecFile, safeExecML } from "./exec";

// validateArgs is not exported, so we test it indirectly via safeExecFile.
// safeExecFile calls validateArgs synchronously before spawning the child process,
// so invalid inputs throw immediately without calling the actual executable.

describe("safeExecFile security validation", () => {
  describe("executable allowlist", () => {
    it("allows python executable", () => {
      // Throws during validateArgs (no such script), not during spawn
      expect(() =>
        safeExecFile("python", ["nonexistent.py", "train"], {}, () => {})
      ).toThrow(/nonexistent\.py/);
    });

    it("allows python3 executable", () => {
      expect(() =>
        safeExecFile("python3", ["nonexistent.py", "train"], {}, () => {})
      ).toThrow(/nonexistent\.py/);
    });

    it("allows python.exe executable", () => {
      expect(() =>
        safeExecFile("python.exe", ["nonexistent.py", "train"], {}, () => {})
      ).toThrow(/nonexistent\.py/);
    });

    it("rejects node executable", () => {
      expect(() =>
        safeExecFile("node", ["script.js", "train"], {}, () => {})
      ).toThrow("[Security] Unauthorized executable: node");
    });

    it("rejects bash executable", () => {
      expect(() =>
        safeExecFile("bash", ["script.sh", "train"], {}, () => {})
      ).toThrow("[Security] Unauthorized executable: bash");
    });

    it("rejects ruby executable", () => {
      expect(() =>
        safeExecFile("ruby", ["script.rb", "train"], {}, () => {})
      ).toThrow("[Security] Unauthorized executable: ruby");
    });

    it("rejects perl executable", () => {
      expect(() =>
        safeExecFile("perl", ["script.pl", "train"], {}, () => {})
      ).toThrow("[Security] Unauthorized executable: perl");
    });
  });

  describe("script name allowlist", () => {
    it("allows analyze.py script and returns ChildProcess", () => {
      // Does not throw synchronously; returns ChildProcess for async execution
      const proc = safeExecFile("python", ["analyze.py", "train"], {}, () => {});
      expect(proc).toBeDefined();
      expect(typeof proc.kill).toBe("function");
    });

    it("rejects other script names", () => {
      expect(() =>
        safeExecFile("python", ["evil.py", "train"], {}, () => {})
      ).toThrow("[Security] Unauthorized script execution: evil.py");
    });

    it("allows analyze.py even with path prefix", () => {
      // path.basename extracts the script name, so /tmp/analyze.py is allowed
      const proc = safeExecFile("python", ["/tmp/analyze.py", "train"], {}, () => {});
      expect(proc).toBeDefined();
    });

    it("rejects arbitrary file paths for script name outside analyze.py", () => {
      expect(() =>
        safeExecFile("python", ["/tmp/evil.py", "train"], {}, () => {})
      ).toThrow("[Security] Unauthorized script execution: evil.py");
    });
  });

  describe("command allowlist", () => {
    it("allows predict_file command and returns ChildProcess", () => {
      const proc = safeExecFile("python", ["analyze.py", "predict_file"], {}, () => {});
      expect(proc).toBeDefined();
      expect(typeof proc.kill).toBe("function");
    });

    it("allows train command and returns ChildProcess", () => {
      const proc = safeExecFile("python", ["analyze.py", "train"], {}, () => {});
      expect(proc).toBeDefined();
      expect(typeof proc.kill).toBe("function");
    });

    it("rejects unauthorized commands", () => {
      expect(() =>
        safeExecFile("python", ["analyze.py", "exec"], {}, () => {})
      ).toThrow("[Security] Unauthorized ML command: exec");
    });

    it("rejects shell injection via command", () => {
      expect(() =>
        safeExecFile("python", ["analyze.py", "train; rm -rf /"], {}, () => {})
      ).toThrow("[Security] Unauthorized ML command: train; rm -rf /");
    });
  });

  describe("flag injection prevention", () => {
    it("rejects flag -c as argument", () => {
      expect(() =>
        safeExecFile("python", ["analyze.py", "train", "-c", "os.system('ls')"], {}, () => {})
      ).toThrow("[Security] Argument injection detected");
    });

    it("rejects flag --help as argument", () => {
      expect(() =>
        safeExecFile("python", ["analyze.py", "train", "--help"], {}, () => {})
      ).toThrow("[Security] Argument injection detected");
    });

    it("rejects flag -e as argument", () => {
      expect(() =>
        safeExecFile("python", ["analyze.py", "train", "-e", "print('hi')"], {}, () => {})
      ).toThrow("[Security] Argument injection detected");
    });
  });

  describe("missing arguments", () => {
    it("rejects fewer than 2 arguments", () => {
      expect(() =>
        safeExecFile("python", ["analyze.py"], {}, () => {})
      ).toThrow("[Security] Missing arguments for ML script execution");
    });

    it("rejects zero arguments", () => {
      expect(() =>
        safeExecFile("python", [], {}, () => {})
      ).toThrow("[Security] Missing arguments for ML script execution");
    });
  });

  describe("error message specificity", () => {
    it("error message contains the security keyword", () => {
      expect(() =>
        safeExecFile("bash", ["script.sh", "train"], {}, () => {})
      ).toThrow(/\[Security\]/);
    });

    it("unauthorized executable error includes the executable name", () => {
      expect(() =>
        safeExecFile("node", ["script.js", "train"], {}, () => {})
      ).toThrow("node");
    });
  });
});
