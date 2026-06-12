import { execFile as cpExecFile, ExecFileOptions, ChildProcess, ExecFileException } from "child_process";
import { promisify } from "util";
import path from "path";

const ALLOWED_SCRIPTS = ["analyze.py"];
const ALLOWED_COMMANDS = ["predict_file", "train"];

function validateArgs(executable: string, args: ReadonlyArray<string>) {
  const isPython = executable.endsWith("python") || executable.endsWith("python.exe") || executable.endsWith("python3");
  if (!isPython) {
    throw new Error(`[Security] Unauthorized executable: ${executable}`);
  }

  if (!args || args.length < 2) {
    throw new Error("[Security] Missing arguments for ML script execution.");
  }
  
  const scriptName = path.basename(args[0]);
  if (!ALLOWED_SCRIPTS.includes(scriptName)) {
    throw new Error(`[Security] Unauthorized script execution: ${scriptName}`);
  }

  const command = args[1];
  if (!ALLOWED_COMMANDS.includes(command)) {
    throw new Error(`[Security] Unauthorized ML command: ${command}`);
  }

  for (let i = 2; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("-")) {
      throw new Error(`[Security] Argument injection detected. Flags are not permitted: ${arg}`);
    }
  }
}

export function safeExecFile(
  file: string,
  args: string[],
  options?: any,
  callback?: (error: ExecFileException | null, stdout: string, stderr: string) => void
): ChildProcess {
  validateArgs(file, args);
  return cpExecFile(file, args, options, callback as any);
}

export function safeExecML(
  file: string,
  args: string[],
  options?: any
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    safeExecFile(file, args, options, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}
