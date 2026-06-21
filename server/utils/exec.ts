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

/**
 * Safe Exec File.
 * @param file - The file parameter.
 * @param args - The args parameter.
 * @param options - The options parameter.
 * @param callback - The callback parameter.
 * @returns The result of the operation.
 */
export function safeExecFile(
  file: string,
  args: string[],
  options?: any,
  callback?: (error: ExecFileException | null, stdout: string, stderr: string) => void
): ChildProcess {
  validateArgs(file, args);
  return cpExecFile(file, args, options, callback as any);
}

/**
 * Safe Exec M L.
 * @param file - The file parameter.
 * @param args - The args parameter.
 * @param options - The options parameter.
 * @returns The result of the operation.
 */
export function safeExecML(
  file: string,
  args: string[],
  options?: any
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const execOptions = { maxBuffer: 1024 * 1024 * 10, ...options };
    safeExecFile(file, args, execOptions, (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}
