import { describe, it, expect } from "vitest";
import {
  validateFileUpload,
  getFileExtension,
  sanitizeFilename,
  DEFAULT_CLINICAL_CONFIG,
} from "./fileValidation";

describe("fileValidation", () => {
  describe("validateFileUpload", () => {
    it("accepts valid CSV files", () => {
      const result = validateFileUpload({
        originalname: "data.csv",
        mimetype: "text/csv",
        size: 1000,
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects files exceeding size limit", () => {
      const result = validateFileUpload({
        originalname: "large.csv",
        mimetype: "text/csv",
        size: 10 * 1024 * 1024, // 10MB
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds maximum size");
    });

    it("rejects files with no extension", () => {
      const result = validateFileUpload({
        originalname: "noextension",
        mimetype: "text/csv",
        size: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("no extension");
    });

    it("rejects explicitly blocked extensions", () => {
      const result = validateFileUpload({
        originalname: "malware.exe",
        mimetype: "application/octet-stream",
        size: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed for security reasons");
    });

    it("rejects invalid MIME types", () => {
      const result = validateFileUpload({
        originalname: "file.csv",
        mimetype: "application/x-executable",
        size: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("MIME type");
    });

    it("rejects extension not in allowlist", () => {
      const result = validateFileUpload({
        originalname: "file.txt",
        mimetype: "text/plain",
        size: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/MIME type.*not allowed|extension/i);
    });

    it("rejects MIME type mismatch with extension", () => {
      const result = validateFileUpload({
        originalname: "file.csv",
        mimetype: "application/pdf", // Wrong MIME for .csv
        size: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match");
    });

    it("rejects files with null bytes", () => {
      const result = validateFileUpload({
        originalname: "file\0.csv",
        mimetype: "text/csv",
        size: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("null bytes");
    });

    it("rejects path traversal attempts with ../", () => {
      const result = validateFileUpload({
        originalname: "../../../etc/passwd.csv",
        mimetype: "text/csv",
        size: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("traversal");
    });

    it("rejects path traversal attempts with backslash", () => {
      const result = validateFileUpload({
        originalname: "..\\windows\\system32\\file.csv",
        mimetype: "text/csv",
        size: 1000,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("traversal");
    });

    it("accepts valid PDF files", () => {
      const result = validateFileUpload({
        originalname: "document.pdf",
        mimetype: "application/pdf",
        size: 2000,
      });

      expect(result.valid).toBe(true);
    });

    it("accepts valid Word documents", () => {
      const result = validateFileUpload({
        originalname: "report.docx",
        mimetype:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 3000,
      });

      expect(result.valid).toBe(true);
    });

    it("rejects dangerous executable extensions", () => {
      const dangerous = [".sh", ".bat", ".cmd", ".dll", ".so"];

      for (const ext of dangerous) {
        const filename = `file${ext}`;
        const result = validateFileUpload({
          originalname: filename,
          mimetype: "text/plain",
          size: 1000,
        });

        expect(result.valid).toBe(false);
        expect(result.error).toContain("not allowed");
      }
    });
  });

  describe("getFileExtension", () => {
    it("extracts extension correctly", () => {
      expect(getFileExtension("document.pdf")).toBe(".pdf");
      expect(getFileExtension("data.csv")).toBe(".csv");
      expect(getFileExtension("file.docx")).toBe(".docx");
    });

    it("handles multiple dots in filename", () => {
      expect(getFileExtension("archive.backup.tar.gz")).toBe(".gz");
    });

    it("returns empty string for no extension", () => {
      expect(getFileExtension("noextension")).toBe("");
    });

    it("returns empty string for dot-only filename", () => {
      expect(getFileExtension(".")).toBe("");
    });
  });

  describe("sanitizeFilename", () => {
    it("removes path components", () => {
      expect(sanitizeFilename("/etc/passwd")).toBe("passwd");
      expect(sanitizeFilename("C:\\Windows\\file.txt")).toBe("file.txt");
    });

    it("replaces unsafe characters", () => {
      expect(sanitizeFilename("file@#$%.csv")).toBe("file____.csv");
      expect(sanitizeFilename("my file (1).pdf")).toBe("my_file__1_.pdf");
    });

    it("preserves safe characters", () => {
      expect(sanitizeFilename("my-data_2024.csv")).toBe("my-data_2024.csv");
    });

    it("limits filename length", () => {
      const longName = "a".repeat(300) + ".csv";
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(255);
    });
  });
});
