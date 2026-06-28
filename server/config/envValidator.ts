import { logger } from "../logger";

export interface EnvVar {
  key: string;
  required: boolean;
  type?: "string" | "number" | "enum";
  enumValues?: string[];
  description: string;
}

export const REQUIRED_VARS: EnvVar[] = [
  { key: "DATABASE_URL", required: true, type: "string", description: "PostgreSQL connection string" },
  { key: "JWT_SECRET", required: true, type: "string", description: "Secret key for signing JWTs" },
  { key: "SESSION_SECRET", required: true, type: "string", description: "Secret for express-session" },
  { key: "RESEND_API_KEY", required: true, type: "string", description: "Resend API key for emails" },
  { key: "PORT", required: false, type: "number", description: "Server port (default 5000)" },
  { key: "NODE_ENV", required: false, type: "enum", enumValues: ["development", "production", "test"], description: "Runtime environment" },
  { key: "CORS_ORIGINS", required: false, type: "string", description: "Comma-separated allowed CORS origins" },
  { key: "LOG_LEVEL", required: false, type: "enum", enumValues: ["debug", "info", "warn", "error", "fatal"], description: "Pino log level" },
  { key: "REDIS_URL", required: false, type: "string", description: "Redis connection string for async queues" },
  { key: "HCAPTCHA_SECRET", required: false, type: "string", description: "hCaptcha secret (required if captcha routes enabled)" },
  { key: "HCAPTCHA_SITE_KEY", required: false, type: "string", description: "hCaptcha site key (required if captcha routes enabled)" },
];

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  typeErrors: string[];
}

export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const typeErrors: string[] = [];

  for (const v of REQUIRED_VARS) {
    const raw = process.env[v.key];

    if (!raw) {
      if (v.required) {
        missing.push(`${v.key} — ${v.description}`);
      }
      continue;
    }

    if (v.type === "number") {
      const num = Number(raw);
      if (Number.isNaN(num)) {
        typeErrors.push(`${v.key} — expected a numeric string, got "${raw}"`);
      }
    }

    if (v.type === "enum" && v.enumValues) {
      if (!v.enumValues.includes(raw)) {
        typeErrors.push(`${v.key} — expected one of [${v.enumValues.join(", ")}], got "${raw}"`);
      }
    }
  }

  if (missing.length > 0) {
    logger.error("❌ Missing required environment variables:");
    missing.forEach((m) => logger.error(`   • ${m}`));
  }

  if (typeErrors.length > 0) {
    logger.warn("⚠️  Environment variable type warnings:");
    typeErrors.forEach((t) => logger.warn(`   • ${t}`));
  }

  return { valid: missing.length === 0, missing, typeErrors };
}
