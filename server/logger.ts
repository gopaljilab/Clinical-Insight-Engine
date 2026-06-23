import pino from "pino";
import { AsyncLocalStorage } from "async_hooks";

export const requestContext = new AsyncLocalStorage<string>();

const PHI_FIELDS = [
  "patientName", "patient_name",
  "diagnosis", "symptoms",
  "vitals", "lab_results",
  "ssn", "dob", "phone", "email",
  "password", "passwordHash", "password_hash",
  "token", "secret",
];

const baseLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: PHI_FIELDS.map(f => `["${f}"]`),
    censor: "[REDACTED]",
  },
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function sanitizeSensitiveData(obj: any, seen = new WeakSet()): any {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (seen.has(obj)) {
    return "[Circular]";
  }
  seen.add(obj);

  if (
    obj instanceof Date ||
    obj instanceof RegExp ||
    obj instanceof Promise ||
    Buffer.isBuffer(obj)
  ) {
    return obj;
  }

  if (obj instanceof Error) {
    const errorObj: any = {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
    };
    for (const key of Object.getOwnPropertyNames(obj)) {
      if (key !== "name" && key !== "message" && key !== "stack") {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("auth") ||
          lowerKey.includes("cookie") ||
          lowerKey.includes("token") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("password") ||
          lowerKey.includes("session")
        ) {
          errorObj[key] = "[REDACTED]";
        } else {
          errorObj[key] = sanitizeSensitiveData((obj as any)[key], seen);
        }
      }
    }
    return errorObj;
  }

  if (obj instanceof Map) {
    const sanitizedMap = new Map();
    for (const [key, val] of obj.entries()) {
      const lowerKey = typeof key === "string" ? key.toLowerCase() : "";
      if (
        lowerKey.includes("auth") ||
        lowerKey.includes("cookie") ||
        lowerKey.includes("token") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("password") ||
        lowerKey.includes("session")
      ) {
        sanitizedMap.set(key, "[REDACTED]");
      } else {
        sanitizedMap.set(key, sanitizeSensitiveData(val, seen));
      }
    }
    return sanitizedMap;
  }

  if (obj instanceof Set) {
    const sanitizedSet = new Set();
    for (const val of obj.values()) {
      sanitizedSet.add(sanitizeSensitiveData(val, seen));
    }
    return sanitizedSet;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeSensitiveData(item, seen));
  }

  const sanitized: any = {};
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("auth") ||
      lowerKey.includes("cookie") ||
      lowerKey.includes("token") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("password") ||
      lowerKey.includes("session")
    ) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = sanitizeSensitiveData(obj[key], seen);
    }
  }
  return sanitized;
}

export const logger = new Proxy(baseLogger, {
  get(target, prop, receiver) {
    const origMethod = target[prop as keyof typeof baseLogger];
    if (typeof origMethod === "function") {
      return function (...args: any[]) {
        const reqId = requestContext.getStore();
        if (reqId) {
          if (typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])) {
            args[0] = { requestId: reqId, ...args[0] };
          } else {
            args.unshift({ requestId: reqId });
          }
        }
        // Sanitize any object arguments to redact sensitive keys
        for (let i = 0; i < args.length; i++) {
          if (typeof args[i] === "object" && args[i] !== null) {
            args[i] = sanitizeSensitiveData(args[i]);
          }
        }
        return (origMethod as Function).apply(target, args);
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});
