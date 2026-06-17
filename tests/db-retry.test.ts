import { describe, it, expect, vi } from "vitest";
import { isTransientError, withRetry } from "../server/db";

describe("Database Retry Mechanism", () => {
  describe("isTransientError", () => {
    it("identifies transient PostgreSQL error codes", () => {
      expect(isTransientError({ code: "08006" })).toBe(true);
      expect(isTransientError({ code: "57P01" })).toBe(true);
      expect(isTransientError({ code: "40001" })).toBe(true);
      expect(isTransientError({ code: "23505" })).toBe(false); // Unique violation is not transient
    });

    it("identifies transient connection error messages", () => {
      expect(isTransientError(new Error("Connection terminated unexpectedly"))).toBe(true);
      expect(isTransientError(new Error("read ECONNRESET"))).toBe(true);
      expect(isTransientError(new Error("connect ECONNREFUSED 127.0.0.1:5432"))).toBe(true);
      expect(isTransientError(new Error("timeout expired when trying to acquire a connection"))).toBe(true);
      expect(isTransientError(new Error("Some random database error"))).toBe(false);
    });

    it("handles non-error objects gracefully", () => {
      expect(isTransientError(null)).toBe(false);
      expect(isTransientError(undefined)).toBe(false);
      expect(isTransientError("string error")).toBe(false);
    });
  });

  describe("withRetry helper", () => {
    it("returns result immediately if operation succeeds first time", async () => {
      const operation = vi.fn().mockResolvedValue("success");
      const result = await withRetry("test-op", operation, 3, 1, 1);
      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("retries on transient error and succeeds", async () => {
      let callCount = 0;
      const operation = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          const err: any = new Error("Connection terminated unexpectedly");
          err.code = "08006";
          throw err;
        }
        return "success";
      });

      const result = await withRetry("test-op-retry", operation, 5, 1, 1);
      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("fails immediately on non-transient error", async () => {
      const operation = vi.fn().mockImplementation(async () => {
        throw new Error("Duplicate key value violates unique constraint");
      });

      await expect(withRetry("test-op-fail-immediate", operation, 5, 1, 1)).rejects.toThrow(
        "Duplicate key value violates unique constraint"
      );
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("fails after exceeding max attempts on transient error", async () => {
      const err: any = new Error("read ECONNRESET");
      err.code = "08006";
      const operation = vi.fn().mockRejectedValue(err);

      await expect(withRetry("test-op-exceed-attempts", operation, 3, 1, 1)).rejects.toThrow(
        "read ECONNRESET"
      );
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });
});
