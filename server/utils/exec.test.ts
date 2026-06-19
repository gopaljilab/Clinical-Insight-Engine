import { describe, it, expect } from "vitest";
import { validateArgs } from "./exec";

describe("validateArgs", () => {
  it("accepts valid python3 executable with allowed script and command", () => {
    expect(() =>
      validateArgs("python3", ["analyze.py", "predict_file", "patient.csv"])
    ).not.toThrow();
  });

  it("accepts valid python executable with allowed script and command", () => {
    expect(() =>
      validateArgs("python", ["analyze.py", "train", "dataset.csv"])
    ).not.toThrow();
  });

  it("accepts python.exe on windows", () => {
    expect(() =>
      validateArgs("python.exe", ["analyze.py", "predict_file", "input.csv"])
    ).not.toThrow();
  });

  it("rejects non-python executables", () => {
    expect(() => validateArgs("node", ["script.js"])).toThrow(
      "[Security] Unauthorized executable: node"
    );
    expect(() => validateArgs("ruby", ["script.rb"])).toThrow(
      "[Security] Unauthorized executable: ruby"
    );
    expect(() => validateArgs("bash", ["script.sh"])).toThrow(
      "[Security] Unauthorized executable: bash"
    );
  });

  it("rejects missing or too-few arguments", () => {
    expect(() => validateArgs("python3", [])).toThrow(
      "[Security] Missing arguments for ML script execution."
    );
    expect(() => validateArgs("python3", ["analyze.py"])).toThrow(
      "[Security] Missing arguments for ML script execution."
    );
  });

  it("rejects unauthorized script names", () => {
    expect(() =>
      validateArgs("python3", ["shell.sh", "predict_file"])
    ).toThrow("[Security] Unauthorized script execution: shell.sh");
    expect(() =>
      validateArgs("python3", ["malicious.py", "train"])
    ).toThrow("[Security] Unauthorized script execution: malicious.py");
  });

  it("rejects unauthorized commands", () => {
    expect(() =>
      validateArgs("python3", ["analyze.py", "delete", "file.csv"])
    ).toThrow("[Security] Unauthorized ML command: delete");
    expect(() =>
      validateArgs("python3", ["analyze.py", "exec", "data.csv"])
    ).toThrow("[Security] Unauthorized ML command: exec");
  });

  it("rejects flag-style argument injection", () => {
    expect(() =>
      validateArgs("python3", ["analyze.py", "predict_file", "-rf"])
    ).toThrow("[Security] Argument injection detected. Flags are not permitted: -rf");
    expect(() =>
      validateArgs("python3", ["analyze.py", "predict_file", "--config=evil.cfg"])
    ).toThrow(
      "[Security] Argument injection detected. Flags are not permitted: --config=evil.cfg"
    );
    expect(() =>
      validateArgs("python3", ["analyze.py", "predict_file", "--help"])
    ).toThrow(
      "[Security] Argument injection detected. Flags are not permitted: --help"
    );
    expect(() =>
      validateArgs("python3", ["analyze.py", "train", "-e", "print('hack')"])
    ).toThrow(
      "[Security] Argument injection detected. Flags are not permitted: -e"
    );
  });

  it("accepts allowed positional arguments after the command", () => {
    expect(() =>
      validateArgs("python3", [
        "analyze.py",
        "predict_file",
        "patient1.csv",
        "patient2.csv",
      ])
    ).not.toThrow();
    expect(() =>
      validateArgs("python3", ["analyze.py", "train", "large_dataset.csv"])
    ).not.toThrow();
  });
});
