import { describe, it, expect } from "vitest";
import { safeExecFile } from "./exec";

// We test the security validation behavior of safeExecFile and safeExecML.
// Due to ESM module binding, child_process.execFile cannot be mocked in a way
// that overrides the already-imported reference in exec.ts.
// We test all security-validation paths that throw before execFile is called.

describe("safeExecFile security validation", () => {
  describe("executable validation", () => {
    it("throws for non-python executable (bash)", () => {
      expect(() => {
        safeExecFile("/bin/bash", ["script.sh", "arg1"], {}, () => {});
      }).toThrow("[Security] Unauthorized executable: /bin/bash");
    });

    it("throws for non-python executable (node)", () => {
      expect(() => {
        safeExecFile("node", ["script.js", "arg1"], {}, () => {});
      }).toThrow("Unauthorized executable: node");
    });

    it("throws for non-python executable (perl)", () => {
      expect(() => {
        safeExecFile("perl", ["script.pl", "arg1"], {}, () => {});
      }).toThrow("Unauthorized executable: perl");
    });

    it("does not throw for python3 executable", () => {
      expect(() => {
        safeExecFile("python3", ["analyze.py", "predict_file", "data.csv"], {}, () => {});
      }).not.toThrow();
    });

    it("does not throw for python executable", () => {
      expect(() => {
        safeExecFile("python", ["analyze.py", "train", "model.pkl"], {}, () => {});
      }).not.toThrow();
    });

    it("does not throw for python.exe", () => {
      expect(() => {
        safeExecFile("python.exe", ["analyze.py", "predict_file", "data.csv"], {}, () => {});
      }).not.toThrow();
    });
  });

  describe("argument count validation", () => {
    it("throws when args array is empty", () => {
      expect(() => {
        safeExecFile("python3", [], {}, () => {});
      }).toThrow("[Security] Missing arguments");
    });

    it("throws when args has only one element", () => {
      expect(() => {
        safeExecFile("python3", ["analyze.py"], {}, () => {});
      }).toThrow("[Security] Missing arguments");
    });
  });

  describe("script name validation", () => {
    it("throws for disallowed script name (malicious.py)", () => {
      expect(() => {
        safeExecFile("python3", ["malicious.py", "predict_file", "data.csv"], {}, () => {});
      }).toThrow("Unauthorized script execution: malicious.py");
    });

    it("throws for disallowed script name (setup.py)", () => {
      expect(() => {
        safeExecFile("python3", ["setup.py", "predict_file", "data.csv"], {}, () => {});
      }).toThrow("Unauthorized script execution: setup.py");
    });

    it("does not throw for allowed script name (analyze.py)", () => {
      expect(() => {
        safeExecFile("python3", ["analyze.py", "predict_file", "data.csv"], {}, () => {});
      }).not.toThrow();
    });
  });

  describe("command validation", () => {
    it("throws for disallowed command (shell injection attempt)", () => {
      expect(() => {
        safeExecFile("python3", ["analyze.py", "rm -rf /", "data.csv"], {}, () => {});
      }).toThrow("Unauthorized ML command: rm -rf /");
    });

    it("throws for disallowed command (subprocess)", () => {
      expect(() => {
        safeExecFile("python3", ["analyze.py", "subprocess", "data.csv"], {}, () => {});
      }).toThrow("Unauthorized ML command: subprocess");
    });

    it("does not throw for predict_file command", () => {
      expect(() => {
        safeExecFile("python3", ["analyze.py", "predict_file", "data.csv"], {}, () => {});
      }).not.toThrow();
    });

    it("does not throw for train command", () => {
      expect(() => {
        safeExecFile("python3", ["analyze.py", "train", "model.pkl"], {}, () => {});
      }).not.toThrow();
    });
  });

  describe("flag injection detection", () => {
    it("throws when extra arg starts with hyphen (flag injection)", () => {
      expect(() => {
        safeExecFile("python3", ["analyze.py", "predict_file", "--eval", "os.system('id')"], {}, () => {});
      }).toThrow("Argument injection detected");
    });

    it("throws when third arg starts with hyphen", () => {
      expect(() => {
        safeExecFile("python3", ["analyze.py", "predict_file", "-c", "os.system('whoami')"], {}, () => {});
      }).toThrow("Argument injection detected");
    });

    it("does not throw for data file paths that look like flags", () => {
      // Data file named starting with hyphen is still caught (this is correct security behavior)
      expect(() => {
        safeExecFile("python3", ["analyze.py", "predict_file", "data-file.csv"], {}, () => {});
      }).not.toThrow();
    });
  });
});
