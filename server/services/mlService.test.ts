import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { SimpleSemaphore, generateRequestFingerprint } from "./mlService";

describe("SimpleSemaphore", () => {
  it("acquire returns release function when below maxConcurrency", async () => {
    const sem = new SimpleSemaphore(2);
    const release = await sem.acquire();
    expect(sem.active).toBe(1);
    expect(sem.pending).toBe(0);
    release();
    expect(sem.active).toBe(0);
  });

  it("acquire increments active count", async () => {
    const sem = new SimpleSemaphore(2);
    const r1 = await sem.acquire();
    const r2 = await sem.acquire();
    expect(sem.active).toBe(2);
    r1();
    r2();
  });

  it("third acquire blocks when maxConcurrency is 2", async () => {
    const sem = new SimpleSemaphore(2);
    const r1 = await sem.acquire();
    const r2 = await sem.acquire();
    // Third acquire should be queued (pending = 1)
    let settled = false;
    const thirdAcquire = sem.acquire().then(() => {
      settled = true;
    });
    expect(sem.pending).toBe(1);
    expect(sem.active).toBe(2);
    r2(); // release second slot
    await thirdAcquire;
    expect(settled).toBe(true);
    expect(sem.active).toBe(2);
    r1();
  });

  it("release dequeues first-in-first-out", async () => {
    const sem = new SimpleSemaphore(1);
    const release1 = await sem.acquire();
    const release2Promise = sem.acquire(); // queued
    const release3Promise = sem.acquire(); // queued
    expect(sem.pending).toBe(2);
    release1();
    const release2 = await release2Promise;
    expect(sem.pending).toBe(1); // release3 still pending
    release2();
    const release3 = await release3Promise;
    expect(sem.pending).toBe(0);
    release3();
  });

  it("acquire with timeout rejects if held too long", async () => {
    const sem = new SimpleSemaphore(1);
    const release = await sem.acquire();
    const p = sem.acquire(50);
    await new Promise((r) => setTimeout(r, 60));
    await expect(p).rejects.toThrow("timed out");
    expect(sem.pending).toBe(0);
    release();
  });

  it("timed-out acquire is removed from queue after expiry", async () => {
    const sem = new SimpleSemaphore(1);
    const release = await sem.acquire();
    const p = sem.acquire(50);
    await new Promise((r) => setTimeout(r, 60));
    await expect(p).rejects.toThrow("timed out");
    expect(sem.pending).toBe(0);
    release();
    // Now we should be able to acquire immediately
    const r2 = await sem.acquire();
    expect(sem.active).toBe(1);
    r2();
  });

  it("run helper executes fn and releases semaphore", async () => {
    const sem = new SimpleSemaphore(1);
    const release = await sem.acquire();
    release();
    const result = await sem.run(async () => "result");
    expect(result).toBe("result");
    expect(sem.active).toBe(0);
  });

  it("run helper releases semaphore even if fn throws", async () => {
    const sem = new SimpleSemaphore(1);
    const release = await sem.acquire();
    release();
    await expect(sem.run(async () => { throw new Error("fail"); })).rejects.toThrow("fail");
    expect(sem.active).toBe(0);
  });

  it("run helper with timeout propagates error and releases", async () => {
    const sem = new SimpleSemaphore(1);
    const release = await sem.acquire();
    release();
    await expect(
      sem.run(async () => { throw new Error("boom"); }, 1000)
    ).rejects.toThrow("boom");
    expect(sem.active).toBe(0);
  });

  it("pending getter returns queue length", async () => {
    const sem = new SimpleSemaphore(1);
    expect(sem.pending).toBe(0);
    const release = await sem.acquire();
    const p = sem.acquire();
    expect(sem.pending).toBe(1);
    release();
    await p;
    expect(sem.pending).toBe(0);
  });

  it("active getter returns active count", async () => {
    const sem = new SimpleSemaphore(3);
    expect(sem.active).toBe(0);
    const r1 = await sem.acquire();
    expect(sem.active).toBe(1);
    const r2 = await sem.acquire();
    expect(sem.active).toBe(2);
    r1();
    expect(sem.active).toBe(1);
    r2();
    expect(sem.active).toBe(0);
  });
});

describe("generateRequestFingerprint", () => {
  it("returns a 64-character hex string (SHA-256)", () => {
    const fp = generateRequestFingerprint({ age: 45 }, "user-1");
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns the same fingerprint for the same payload and userId", () => {
    const fp1 = generateRequestFingerprint({ age: 45, bmi: 24 }, "user-1");
    const fp2 = generateRequestFingerprint({ age: 45, bmi: 24 }, "user-1");
    expect(fp1).toBe(fp2);
  });

  it("returns different fingerprints for different payloads", () => {
    const fp1 = generateRequestFingerprint({ age: 45 }, "user-1");
    const fp2 = generateRequestFingerprint({ age: 46 }, "user-1");
    expect(fp1).not.toBe(fp2);
  });

  it("returns different fingerprints for different userIds", () => {
    const fp1 = generateRequestFingerprint({ age: 45 }, "user-1");
    const fp2 = generateRequestFingerprint({ age: 45 }, "user-2");
    expect(fp1).not.toBe(fp2);
  });

  it("handles nested object payloads deterministically", () => {
    const fp1 = generateRequestFingerprint({ patient: { age: 45, bmi: 24.5 } }, "user-1");
    const fp2 = generateRequestFingerprint({ patient: { age: 45, bmi: 24.5 } }, "user-1");
    expect(fp1).toBe(fp2);
  });

  it("handles array payloads deterministically", () => {
    const fp1 = generateRequestFingerprint([{ age: 45 }, { age: 62 }], "user-1");
    const fp2 = generateRequestFingerprint([{ age: 45 }, { age: 62 }], "user-1");
    expect(fp1).toBe(fp2);
  });

  it("handles null and undefined gracefully", () => {
    const fp1 = generateRequestFingerprint(null, "user-1");
    const fp2 = generateRequestFingerprint(undefined, "user-1");
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);
    expect(fp2).toMatch(/^[a-f0-9]{64}$/);
  });

  it("object key order does not affect fingerprint (canonical stringify)", () => {
    const fp1 = generateRequestFingerprint({ a: 1, b: 2 }, "user-1");
    const fp2 = generateRequestFingerprint({ b: 2, a: 1 }, "user-1");
    expect(fp1).toBe(fp2);
  });
});
