import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the handlers registered via worker.on(...) so we can invoke them
// directly, simulating BullMQ emitting "completed"/"failed" after the real
// job finishes — which happens long after queue.add() has already resolved.
const workerHandlers: Record<string, (...args: any[]) => void> = {};

vi.mock("bullmq", () => {
  const mockQueue = {
    name: "assessmentQueue",
    add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    Queue: vi.fn().mockImplementation(() => mockQueue),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        workerHandlers[event] = handler;
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    Job: vi.fn(),
  };
});

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    status: "ready",
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue("PONG"),
    quit: vi.fn().mockResolvedValue(undefined),
    defineCommand: vi.fn(),
  })),
}));

vi.mock("./logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { startAssessmentWorker, verifyRedisConnection } from "./queue";
import { MLService } from "./services/mlService";

describe("assessment worker — fingerprint cleanup", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    MLService.activeInferenceRequests.clear();
    await verifyRedisConnection();
    startAssessmentWorker();
  });

  it("releases the fingerprint when the job completes", () => {
    const fingerprint = "fp-completed";
    MLService.activeInferenceRequests.add(fingerprint);

    const job = { id: "job-1", data: { requestFingerprint: fingerprint } };
    workerHandlers["completed"](job);

    expect(MLService.activeInferenceRequests.has(fingerprint)).toBe(false);
  });

  it("releases the fingerprint once retries are exhausted on failure", () => {
    const fingerprint = "fp-failed-final";
    MLService.activeInferenceRequests.add(fingerprint);

    const job = {
      id: "job-2",
      data: { requestFingerprint: fingerprint },
      attemptsMade: 5,
      opts: { attempts: 5 },
    };
    workerHandlers["failed"](job, new Error("boom"));

    expect(MLService.activeInferenceRequests.has(fingerprint)).toBe(false);
  });

  it("keeps the fingerprint reserved on an intermediate failed attempt (retry still pending)", () => {
    const fingerprint = "fp-failed-retry";
    MLService.activeInferenceRequests.add(fingerprint);

    const job = {
      id: "job-3",
      data: { requestFingerprint: fingerprint },
      attemptsMade: 1,
      opts: { attempts: 5 },
    };
    workerHandlers["failed"](job, new Error("transient"));

    // A retry is still pending, so releasing the fingerprint now would
    // reopen the exact race the fingerprint exists to prevent.
    expect(MLService.activeInferenceRequests.has(fingerprint)).toBe(true);
  });
});