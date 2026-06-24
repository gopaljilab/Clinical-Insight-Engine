import { describe, expect, it, vi } from "vitest";
import { safeExecFile, safeExecML } from "./utils/exec";

describe("safeExecFile", () => {
  it("throws for non-python executable", () => {
    expect(() => {
      safeExecFile("/bin/bash", ["arg1", "arg2"], {}, () => {});
    }).toThrow("Unauthorized executable");
  });

  it("throws when args length is less than 2", () => {
    expect(() => {
      safeExecFile("python3", ["only_one"], {}, () => {});
    }).toThrow("Missing arguments");
  });

  it("throws for script not in ALLOWED_SCRIPTS", () => {
    expect(() => {
      safeExecFile("python3", ["malicious.py", "predict_file"], {}, () => {});
    }).toThrow("Unauthorized script execution");
  });

  it("throws for command not in ALLOWED_COMMANDS", () => {
    expect(() => {
      safeExecFile("python3", ["analyze.py", "delete_all_data"], {}, () => {});
    }).toThrow("Unauthorized ML command");
  });

  it("throws when an argument starts with a dash (flag injection)", () => {
    expect(() => {
      safeExecFile(
        "python3",
        ["analyze.py", "predict_file", "--model=evil"],
        {},
        () => {}
      );
    }).toThrow("Argument injection detected");
  });

  it("does not throw for valid input", () => {
    // The underlying cpExecFile will fail to run python/analyze.py,
    // but validateArgs should not throw for valid-looking input.
    let threw = false;
    let errorReceived = false;
    try {
      safeExecFile(
        "python3",
        ["analyze.py", "predict_file"],
        {},
        (err) => {
          // cpExecFile callback: expect an error because python/analyze.py
          // does not exist in this environment, but the call itself succeeded
          // past validation.
          errorReceived = true;
        }
      );
    } catch (err) {
      threw = true;
    }
    // Should not throw synchronously; callback will receive the error
    expect(threw).toBe(false);
  });
});

describe("safeExecML", () => {
  it("rejects unauthorized executable", async () => {
    await expect(
      safeExecML("/usr/bin/ruby", ["script.rb"])
    ).rejects.toThrow("Unauthorized executable");
  });

  it("rejects missing arguments", async () => {
    await expect(
      safeExecML("python", ["only_one"])
    ).rejects.toThrow("Missing arguments");
  });

  it("rejects disallowed script", async () => {
    await expect(
      safeExecML("python3", ["evil.py", "predict"])
    ).rejects.toThrow("Unauthorized script execution");
  });

  it("rejects disallowed command", async () => {
    await expect(
      safeExecML("python3", ["analyze.py", "destroy"])
    ).rejects.toThrow("Unauthorized ML command");
  });

  it("rejects flag injection in arguments", async () => {
    await expect(
      safeExecML("python3", ["analyze.py", "predict_file", "-e", "print('hack')"])
    ).rejects.toThrow("Argument injection detected");
  });
});
