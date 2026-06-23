import { describe, expect, it } from "vitest";
import { sanitizeSensitiveData } from "./logger";

describe("sanitizeSensitiveData", () => {
  describe("primitive values", () => {
    it("returns null as-is", () => {
      expect(sanitizeSensitiveData(null)).toBeNull();
    });

    it("returns a number as-is", () => {
      expect(sanitizeSensitiveData(42)).toBe(42);
    });

    it("returns a string as-is", () => {
      expect(sanitizeSensitiveData("hello")).toBe("hello");
    });

    it("returns a boolean as-is", () => {
      expect(sanitizeSensitiveData(true)).toBe(true);
    });
  });

  describe("plain objects", () => {
    it("passes through plain objects with no sensitive keys", () => {
      const input = { name: "Alice", age: 30 };
      expect(sanitizeSensitiveData(input)).toEqual({ name: "Alice", age: 30 });
    });

    it("redacts keys containing 'password'", () => {
      const input = { user: "alice", password: "s3cr3t" };
      const result = sanitizeSensitiveData(input);
      expect(result.user).toBe("alice");
      expect(result.password).toBe("[REDACTED]");
    });

    it("redacts keys containing 'token'", () => {
      const input = { endpoint: "/api", authToken: "tok_abc123" };
      const result = sanitizeSensitiveData(input);
      expect(result.endpoint).toBe("/api");
      expect(result.authToken).toBe("[REDACTED]");
    });

    it("redacts keys containing 'cookie'", () => {
      const input = { route: "/home", sessionCookie: "sid=xyz" };
      const result = sanitizeSensitiveData(input);
      expect(result.route).toBe("/home");
      expect(result.sessionCookie).toBe("[REDACTED]");
    });

    it("redacts keys containing 'auth'", () => {
      const input = { action: "login", authMethod: "jwt" };
      const result = sanitizeSensitiveData(input);
      expect(result.action).toBe("login");
      expect(result.authMethod).toBe("[REDACTED]");
    });

    it("redacts keys containing 'secret'", () => {
      const input = { id: 1, apiSecret: "top-secret" };
      const result = sanitizeSensitiveData(input);
      expect(result.id).toBe(1);
      expect(result.apiSecret).toBe("[REDACTED]");
    });

    it("redacts keys containing 'session'", () => {
      const input = { id: 1, sessionId: "sess_abc" };
      const result = sanitizeSensitiveData(input);
      expect(result.id).toBe(1);
      expect(result.sessionId).toBe("[REDACTED]");
    });

    it("redacts nested sensitive keys", () => {
      const input = { user: { name: "bob", passwordHash: "abc" } };
      const result = sanitizeSensitiveData(input);
      expect(result.user.name).toBe("bob");
      expect(result.user.passwordHash).toBe("[REDACTED]");
    });
  });

  describe("circular references", () => {
    it("returns [Circular] for a self-referencing object", () => {
      const input: any = { id: 1 };
      input.self = input;
      const result = sanitizeSensitiveData(input);
      expect(result.id).toBe(1);
      expect(result.self).toBe("[Circular]");
    });

    it("handles a WeakSet already-seen sentinel across calls", () => {
      const seen = new WeakSet();
      const obj: any = { name: "test" };
      obj.self = obj;
      const result = sanitizeSensitiveData(obj, seen);
      expect(result.self).toBe("[Circular]");
    });
  });

  describe("Error instances", () => {
    it("keeps name, message, and stack on Error", () => {
      const err = new Error("boom");
      const result = sanitizeSensitiveData(err);
      expect(result.name).toBe("Error");
      expect(result.message).toBe("boom");
      expect(result.stack).toBe(err.stack);
    });

    it("redacts sensitive own properties on Error", () => {
      const err = new Error("boom");
      (err as any).authToken = "tok_xyz";
      (err as any).statusCode = 401;
      const result = sanitizeSensitiveData(err);
      expect(result.authToken).toBe("[REDACTED]");
      expect(result.statusCode).toBe(401);
    });

    it("does not traverse Error keys recursively beyond first level", () => {
      const err = new Error("boom");
      (err as any).reason = { token: "secret" };
      const result = sanitizeSensitiveData(err);
      expect(result.reason).toEqual({ token: "[REDACTED]" });
    });
  });

  describe("Map instances", () => {
    it("sanitizes Map values normally when keys are not sensitive", () => {
      const map = new Map([["name", "Alice"], ["age", 30]]);
      const result = sanitizeSensitiveData(map);
      expect(result).toBeInstanceOf(Map);
      expect(Array.from(result.entries())).toEqual([["name", "Alice"], ["age", 30]]);
    });

    it("redacts Map values when map key contains sensitive terms", () => {
      const map = new Map([["tokenKey", "tok_abc"], ["name", "Bob"]]);
      const result = sanitizeSensitiveData(map);
      expect(Array.from(result.entries())).toEqual([["tokenKey", "[REDACTED]"], ["name", "Bob"]]);
    });

    it("recursively sanitizes Map values", () => {
      const map = new Map([["data", { password: "secret" }]]);
      const result = sanitizeSensitiveData(map);
      expect(Array.from(result.entries())).toEqual([["data", { password: "[REDACTED]" }]]);
    });
  });

  describe("Set instances", () => {
    it("preserves non-sensitive Set values", () => {
      const set = new Set([1, "hello", { name: "Alice" }]);
      const result = sanitizeSensitiveData(set);
      expect(result).toBeInstanceOf(Set);
      expect(Array.from(result)).toEqual([1, "hello", { name: "Alice" }]);
    });

    it("sanitizes objects inside Set", () => {
      const set = new Set([{ name: "Bob", password: "secret" }]);
      const result = sanitizeSensitiveData(set);
      expect(Array.from(result)).toEqual([{ name: "Bob", password: "[REDACTED]" }]);
    });
  });

  describe("Array instances", () => {
    it("sanitizes each element of a plain array", () => {
      const input = [{ name: "Alice" }, { name: "Bob", token: "tok_xyz" }];
      const result = sanitizeSensitiveData(input);
      expect(result).toEqual([{ name: "Alice" }, { name: "Bob", token: "[REDACTED]" }]);
    });

    it("returns empty array as-is", () => {
      expect(sanitizeSensitiveData([])).toEqual([]);
    });

    it("handles mixed-type arrays", () => {
      const input = ["string", 42, true, { token: "x" }];
      const result = sanitizeSensitiveData(input);
      expect(result).toEqual(["string", 42, true, { token: "[REDACTED]" }]);
    });
  });

  describe("special object types", () => {
    it("returns Date instances as-is", () => {
      const date = new Date("2025-01-01");
      expect(sanitizeSensitiveData(date)).toBe(date);
    });

    it("returns RegExp instances as-is", () => {
      const re = /test/;
      expect(sanitizeSensitiveData(re)).toBe(re);
    });

    it("returns Promise instances as-is", () => {
      const p = Promise.resolve(1);
      expect(sanitizeSensitiveData(p)).toBe(p);
    });

    it("returns Buffer instances as-is", () => {
      const buf = Buffer.from("hello");
      expect(sanitizeSensitiveData(buf)).toBe(buf);
    });
  });
});
