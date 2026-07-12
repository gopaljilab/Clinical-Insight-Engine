/**
 * fileValidation.ts
 *
 * Comprehensive file validation for clinical document uploads.
 * Prevents upload of non-clinical formats and malicious files.
 * Implements multiple validation layers for security hardening.
 */

import { logger } from "../logger";

export interface FileValidationConfig {
  maxFileSize: number; // bytes
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  requireExtensionMatch: boolean;
  blockExtensions: string[]; // Explicitly blocked extensions
}

/**
 * Default configuration for clinical document uploads
 */
export const DEFAULT_CLINICAL_CONFIG: FileValidationConfig = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedMimeTypes: [
    "text/csv",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  allowedExtensions: [".csv", ".pdf", ".doc", ".docx"],
  requireExtensionMatch: true,
  blockExtensions: [
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".py",
    ".js",
    ".zip",
    ".rar",
    ".7z",
    ".dll",
    ".so",
    ".dmg",
  ],
};

/**
 * Validate uploaded file against security policies
 */
export function validateFileUpload(
  file: {
    originalname: string;
    mimetype: string;
    size: number;
    buffer?: Buffer;
  },
  config: FileValidationConfig = DEFAULT_CLINICAL_CONFIG
): { valid: boolean; error?: string } {
  // 1. Check file size
  if (file.size > config.maxFileSize) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${config.maxFileSize / 1024 / 1024}MB`,
    };
  }

  // 2. Extract and validate extension
  const extension = getFileExtension(file.originalname);
  if (!extension) {
    return {
      valid: false,
      error: "File has no extension",
    };
  }

  // 3. Check explicitly blocked extensions
  if (config.blockExtensions.includes(extension.toLowerCase())) {
    return {
      valid: false,
      error: `File type ${extension} is not allowed for security reasons`,
    };
  }

  // 4. Validate MIME type
  if (!config.allowedMimeTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `MIME type '${file.mimetype}' is not allowed. Allowed types: ${config.allowedMimeTypes.join(", ")}`,
    };
  }

  // 5. Validate extension
  if (!config.allowedExtensions.map((e) => e.toLowerCase()).includes(extension.toLowerCase())) {
    return {
      valid: false,
      error: `File extension '${extension}' is not allowed. Allowed extensions: ${config.allowedExtensions.join(", ")}`,
    };
  }

  // 6. If required, verify MIME type matches extension
  if (config.requireExtensionMatch) {
    const extensionMimeMap: Record<string, string[]> = {
      ".csv": ["text/csv"],
      ".pdf": ["application/pdf"],
      ".doc": ["application/msword"],
      ".docx": [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
    };

    const expectedMimes = extensionMimeMap[extension.toLowerCase()] || [];
    if (expectedMimes.length > 0 && !expectedMimes.includes(file.mimetype)) {
      return {
        valid: false,
        error: `MIME type '${file.mimetype}' does not match file extension '${extension}'`,
      };
    }
  }

  // 7. Additional safety: Check for null bytes in filename (path traversal attempt)
  if (file.originalname.includes("\0")) {
    return {
      valid: false,
      error: "File contains null bytes",
    };
  }

  // 8. Check for directory traversal attempts
  if (file.originalname.includes("..") || file.originalname.includes("/") || file.originalname.includes("\\")) {
    return {
      valid: false,
      error: "File path contains traversal sequences",
    };
  }

  logger.info(
    {
      filename: file.originalname,
      extension,
      mimetype: file.mimetype,
      size: file.size,
    },
    "File validation passed"
  );

  return { valid: true };
}

/**
 * Extract file extension safely
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return "";
  }
  return filename.substring(lastDotIndex);
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  const baseName = filename.split(/[\\/]/).pop() || "file";

  // Replace unsafe characters with underscores
  const sanitized = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Limit length
  const MAX_LENGTH = 255;
  return sanitized.substring(0, MAX_LENGTH);
}
