import { vi } from "vitest";

// Mock ioredis globally for all tests
vi.mock("ioredis", () => {
  return {
    default: vi.fn().mockImplementation(function MockIORedis() {
      return {
        status: "ready",
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        ping: vi.fn().mockResolvedValue("PONG"),
        quit: vi.fn().mockResolvedValue(undefined),
        defineCommand: vi.fn(),
      };
    }),
  };
});

// Mock bullmq globally for all tests
vi.mock("bullmq", () => {
  return {
    Queue: vi.fn(function MockQueue() {
      return {
        add: vi.fn().mockResolvedValue({ id: "mock-job-id" }),
        getJob: vi.fn().mockResolvedValue(null),
        on: vi.fn(),
      };
    }),
    Worker: vi.fn(function MockWorker() {
      return {
        on: vi.fn(),
        close: vi.fn(),
      };
    }),
    Job: vi.fn(),
  };
});
