import { describe, it, expect, vi, beforeEach } from "vitest";

// Override bullmq mock to include monitoring methods
vi.mock("bullmq", () => {
  const mockQueue = {
    name: "assessmentQueue",
    add: vi.fn().mockResolvedValue({
      id: "mock-job-id",
      name: "predict",
      data: {},
      opts: { attempts: 5, backoff: { type: "exponential", delay: 2000 } },
    }),
    getJob: vi.fn().mockResolvedValue(null),
    getWaitingCount: vi.fn().mockResolvedValue(0),
    getActiveCount: vi.fn().mockResolvedValue(0),
    getCompletedCount: vi.fn().mockResolvedValue(42),
    getFailedCount: vi.fn().mockResolvedValue(0),
    getDelayedCount: vi.fn().mockResolvedValue(0),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };
  return {
    Queue: vi.fn().mockImplementation(() => mockQueue),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    Job: vi.fn(),
  };
});

vi.mock("ioredis", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      status: "ready",
      on: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue("PONG"),
      quit: vi.fn().mockResolvedValue(undefined),
      defineCommand: vi.fn(),
    })),
  };
});

vi.mock("./db", () => {
  return {
    getPool: vi.fn(),
    withRetry: vi.fn(async (name, fn) => fn()),
  };
});

import {
  isQueueAvailable,
  getAssessmentQueue,
  verifyRedisConnection,
  getQueueMetrics,
  getRedisConnection,
} from "./queue";

describe("queue module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not throw when imported", () => {
    expect(isQueueAvailable).toBeDefined();
    expect(getAssessmentQueue).toBeDefined();
    expect(getQueueMetrics).toBeDefined();
  });

  it("reports queue as available in test mode", () => {
    expect(isQueueAvailable()).toBe(true);
  });

  it("verifyRedisConnection succeeds in test mode", async () => {
    await expect(verifyRedisConnection()).resolves.toBe(true);
    expect(isQueueAvailable()).toBe(true);
  });

  it("creates queue lazily via getAssessmentQueue", () => {
    const queue = getAssessmentQueue();
    expect(queue).toBeDefined();
    expect(queue.name).toBe("assessmentQueue");
  });

  it("returns queue metrics when queue is available", async () => {
    const metrics = await getQueueMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.available).toBe(true);
    expect(metrics.name).toBe("assessmentQueue");
    expect(metrics.counts).toBeDefined();
    expect(metrics.counts).toHaveProperty("waiting", 0);
    expect(metrics.counts).toHaveProperty("active", 0);
    expect(metrics.counts).toHaveProperty("completed", 42);
    expect(metrics.counts).toHaveProperty("failed", 0);
    expect(metrics.counts).toHaveProperty("delayed", 0);
    expect(metrics.workerActive).toBe(false);
    expect(metrics.redisConnected).toBe(true);
    expect(metrics.config).toBeDefined();
    expect(metrics.config.maxRetries).toBe(5);
    expect(metrics.config.backoffDelayMs).toBeGreaterThan(0);
    expect(metrics.config.lockDurationMs).toBeGreaterThan(0);
  });

  it("handles queue metrics error gracefully", async () => {
    const queue = getAssessmentQueue();
    vi.mocked(queue.getWaitingCount).mockRejectedValueOnce(new Error("redis down"));
    const metrics = await getQueueMetrics();
    expect(metrics.available).toBe(false);
    expect(metrics.error).toBeDefined();
  });

  it("getQueueMetrics returns available false when queue is null", async () => {
    vi.stubEnv("QUEUE_MAX_RETRIES", "5");
    const metrics = await getQueueMetrics();
    expect(metrics).toBeDefined();
  });

  it("getRedisConnection returns a singleton connection", () => {
    const conn1 = getRedisConnection();
    const conn2 = getRedisConnection();
    expect(conn1).toBe(conn2);
  });
});

describe("worker DLQ handling", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { closeQueue } = await import("./queue");
    await closeQueue();
  });

  it("inserts failed job into DLQ when retries are exhausted", async () => {
    const mockQuery = vi.fn().mockResolvedValue({ rowCount: 1 });
    const mockRelease = vi.fn();
    const mockConnect = vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease });
    
    const dbModule = await import("./db");
    vi.mocked(dbModule.getPool).mockReturnValue({ connect: mockConnect } as any);

    const { startAssessmentWorker, verifyRedisConnection } = await import("./queue");
    await verifyRedisConnection();
    startAssessmentWorker();

    const { Worker } = await import("bullmq");
    const workerMock = vi.mocked(Worker).mock.results[0].value;
    
    // Find the 'failed' event handler
    const failedHandlerCall = workerMock.on.mock.calls.find((call: any[]) => call[0] === "failed");
    expect(failedHandlerCall).toBeDefined();
    
    const failedHandler = failedHandlerCall[1];
    
    // Trigger the handler with max retries
    const mockJob = { id: "test-job-123", data: { foo: "bar" }, attemptsMade: 5 };
    await failedHandler(mockJob, new Error("ML crashed"));
    
    expect(mockConnect).toHaveBeenCalled();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO dead_letter_jobs"),
      expect.arrayContaining(["test-job-123", JSON.stringify({ foo: "bar" }), expect.any(String)])
    );
    expect(mockRelease).toHaveBeenCalled();
  });

  it("does NOT insert into DLQ when retries are less than max", async () => {
    const mockQuery = vi.fn();
    const mockRelease = vi.fn();
    const mockConnect = vi.fn().mockResolvedValue({ query: mockQuery, release: mockRelease });
    
    const dbModule = await import("./db");
    vi.mocked(dbModule.getPool).mockReturnValue({ connect: mockConnect } as any);

    const { startAssessmentWorker, verifyRedisConnection } = await import("./queue");
    await verifyRedisConnection();
    startAssessmentWorker();

    const { Worker } = await import("bullmq");
    const workerMock = vi.mocked(Worker).mock.results[0].value;
    
    const failedHandlerCall = workerMock.on.mock.calls.find((call: any[]) => call[0] === "failed");
    expect(failedHandlerCall).toBeDefined();
    
    const failedHandler = failedHandlerCall[1];
    
    // Trigger with 3 attempts (less than QUEUE_MAX_RETRIES which is 5)
    const mockJob = { id: "test-job-early-fail", data: {}, attemptsMade: 3 };
    await failedHandler(mockJob, new Error("Transient network error"));
    
    // DB connect/query should NOT be called
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
