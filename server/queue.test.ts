import { describe, it, expect } from "vitest";
import {
  isQueueAvailable,
  getAssessmentQueue,
  verifyRedisConnection,
} from "./queue";

describe("queue module", () => {
  it("does not throw when imported", () => {
    expect(isQueueAvailable).toBeDefined();
    expect(getAssessmentQueue).toBeDefined();
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
    expect(queue.add).toBeDefined();
  });
});
