import { describe, it, expect } from "vitest";
import {
  sanitizeErrorMessage,
  getSafeServerErrorMessage,
  getSafeClientErrorMessage,
} from "./errorSanitizer";

describe("errorSanitizer", () => {
  describe("sanitizeErrorMessage", () => {
    it("removes stack traces from error messages", () => {
      const error = new Error("Database error at /home/user/app/db.ts (line 42:15)");
      const result = sanitizeErrorMessage(error);
      expect(result).not.toContain("/home/user");
      expect(result).toBe("An error occurred");
    });

    it("removes file paths from error messages", () => {
      const error = new Error("Failed to read /var/lib/app/config.json");
      const result = sanitizeErrorMessage(error);
      expect(result).not.toContain("/var/lib/app");
      expect(result).toBe("An error occurred");
    });

    it("removes Windows file paths", () => {
      const error = new Error("Failed at C:\\Users\\admin\\app\\server.js line 100");
      const result = sanitizeErrorMessage(error);
      expect(result).not.toContain("C:\\");
      expect(result).toBe("An error occurred");
    });

    it("removes SQL error details", () => {
      const error = new Error("database error: relation 'users' does not exist");
      const result = sanitizeErrorMessage(error);
      expect(result).toBe("An error occurred");
    });

    it("removes credential references", () => {
      const error = new Error("Authentication failed: API key mismatch");
      const result = sanitizeErrorMessage(error);
      expect(result).toBe("An error occurred");
    });

    it("removes password references", () => {
      const error = new Error("Database password validation failed");
      const result = sanitizeErrorMessage(error);
      expect(result).toBe("An error occurred");
    });

    it("removes IP addresses", () => {
      const error = new Error("Connection refused from 192.168.1.100");
      const result = sanitizeErrorMessage(error);
      expect(result).not.toContain("192.168.1.100");
      expect(result).toBe("An error occurred");
    });

    it("allows generic numbers in messages", () => {
      const error = new Error("Process 5432 crashed");
      const result = sanitizeErrorMessage(error);
      // Generic numbers are allowed; only sensitive patterns are blocked
      expect(result).toBe("Process 5432 crashed");
    });

    it("returns default message for null or undefined", () => {
      expect(sanitizeErrorMessage(null)).toBe("An error occurred");
      expect(sanitizeErrorMessage(undefined)).toBe("An error occurred");
    });

    it("accepts custom default message", () => {
      const error = new Error("Stack trace at /var/app/error.ts");
      const result = sanitizeErrorMessage(error, "Custom error occurred");
      expect(result).toBe("Custom error occurred");
    });

    it("handles ENOENT error code", () => {
      const error = new Error("ENOENT: no such file or directory");
      (error as any).code = "ENOENT";
      const result = sanitizeErrorMessage(error);
      expect(result).toBe("Resource not found");
    });

    it("handles EACCES error code", () => {
      const error = new Error("EACCES: permission denied");
      (error as any).code = "EACCES";
      const result = sanitizeErrorMessage(error);
      expect(result).toBe("Access denied");
    });

    it("handles ETIMEDOUT error code", () => {
      const error = new Error("ETIMEDOUT: operation timed out");
      (error as any).code = "ETIMEDOUT";
      const result = sanitizeErrorMessage(error);
      expect(result).toBe("Request timed out");
    });

    it("removes messages with 'Internal' keyword", () => {
      const error = new Error("Internal system error occurred");
      const result = sanitizeErrorMessage(error);
      expect(result).toBe("An error occurred");
    });

    it("removes messages with 'Uncaught' keyword", () => {
      const error = new Error("Uncaught exception in main thread");
      const result = sanitizeErrorMessage(error);
      expect(result).toBe("An error occurred");
    });

    it("handles string error messages", () => {
      const result = sanitizeErrorMessage("Database error at /var/app/db.ts");
      expect(result).toBe("An error occurred");
    });

    it("handles object with message property", () => {
      const error = { message: "Failed at /home/user/app.ts line 50" };
      const result = sanitizeErrorMessage(error);
      expect(result).toBe("An error occurred");
    });

    it("preserves safe error messages", () => {
      const error = new Error("Validation failed: email is required");
      const result = sanitizeErrorMessage(error);
      // This should be preserved as it doesn't match sensitive patterns
      expect(result).toBe("Validation failed: email is required");
    });

    it("preserves safe timeout message", () => {
      const error = new Error("Request timed out after 30 seconds");
      const result = sanitizeErrorMessage(error);
      expect(result).toContain("timed out");
    });
  });

  describe("getSafeServerErrorMessage", () => {
    it("always returns generic message for server errors", () => {
      const error = new Error("Sensitive DB error at /var/database/backup.sql");
      const result = getSafeServerErrorMessage(error);
      expect(result).toBe("An internal server error occurred");
    });

    it("returns generic message even for undefined errors", () => {
      const result = getSafeServerErrorMessage();
      expect(result).toBe("An internal server error occurred");
    });

    it("never exposes file paths in server error message", () => {
      const error = new Error("/var/sensitive/path/exposed.ts");
      const result = getSafeServerErrorMessage(error);
      expect(result).not.toContain("/var");
    });
  });

  describe("getSafeClientErrorMessage", () => {
    it("returns safe validation error messages", () => {
      const error = new Error("Email format is invalid");
      const result = getSafeClientErrorMessage(error);
      expect(result).toContain("invalid");
    });

    it("removes file paths from client errors", () => {
      const error = new Error("Parse error at /app/parser.js:42");
      const result = getSafeClientErrorMessage(error);
      expect(result).not.toContain("/app/parser");
    });

    it("returns default message for sensitive client errors", () => {
      const error = new Error("Database connection at 192.168.1.1 failed");
      const result = getSafeClientErrorMessage(error, "Connection error");
      expect(result).toBe("Connection error");
    });

    it("preserves safe validation messages", () => {
      const error = new Error("Password must be at least 8 characters");
      const result = getSafeClientErrorMessage(error);
      expect(result).toContain("8 characters");
    });
  });
});
