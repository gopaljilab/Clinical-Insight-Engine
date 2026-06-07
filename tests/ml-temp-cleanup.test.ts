const { mockExecFile, mockWriteFile, mockUnlink } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockUnlink: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFile: mockExecFile,
}));

vi.mock("fs/promises", () => ({
  writeFile: mockWriteFile,
  unlink: mockUnlink,
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAssessmentInference } from "../server/services/mlService";

describe("ML temp file cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
    mockExecFile.mockImplementation((_cmd, _args, _opts, callback) => {
      const child = {
        kill: vi.fn(),
        on: vi.fn((_event, listener) => {
          setTimeout(listener, 0);
          return child;
        }),
      };

      setTimeout(() => {
        callback(
          null,
          JSON.stringify({
            riskScore: 12,
            riskCategory: "LOW",
            factors: [],
          }),
          ""
        );
      }, 0);

      return child;
    });
  });

  it("unlinks the same tempFilePath used for writeFile and Python inference", async () => {
    await runAssessmentInference({ patientName: "Test Patient" });

    const writtenPath = mockWriteFile.mock.calls[0][0];
    const pythonInputPath = mockExecFile.mock.calls[0][1][2];
    const unlinkedPath = mockUnlink.mock.calls[0][0];

    expect(typeof writtenPath).toBe("string");
    expect(writtenPath).toBe(pythonInputPath);
    expect(unlinkedPath).toBe(writtenPath);
  });
});
