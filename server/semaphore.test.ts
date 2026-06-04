import { describe, expect, it } from "vitest";
import { SimpleSemaphore } from "./routes";

describe("SimpleSemaphore", () => {
  it("limits concurrency to the specified maximum", async () => {
    const sem = new SimpleSemaphore(2);
    let active = 0;
    let maxSeenActive = 0;

    const task = async () => {
      await sem.run(async () => {
        active++;
        if (active > maxSeenActive) {
          maxSeenActive = active;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        active--;
      });
    };

    // Run 5 tasks concurrently
    await Promise.all([task(), task(), task(), task(), task()]);

    expect(maxSeenActive).toBeLessThanOrEqual(2);
    expect(active).toBe(0);
  });
});
