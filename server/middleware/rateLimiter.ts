import { Request, Response, NextFunction } from "express";

const requestStore = new Map<string, { count: number; resetTime: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 60;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Periodically removes expired entries from the rate limit store
 * to prevent unbounded memory growth from unique IPs that never return.
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, record] of requestStore) {
    if (now > record.resetTime) {
      requestStore.delete(key);
    }
  }
}

// Schedule periodic cleanup to prevent memory leaks
const cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
cleanupTimer.unref(); // Allow the process to exit without waiting for this timer

/**
 * Extracts the client IP from the request, parsing x-forwarded-for
 * to use only the first (original client) IP address.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    // x-forwarded-for can be comma-separated; first entry is the client
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

export const publicApiRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = requestStore.get(ip);

  if (!record || now > record.resetTime) {
    requestStore.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_REQUESTS) {
    console.warn(`[RATE LIMIT EXCEEDED] DDoS protection triggered for IP: ${ip}`);
    return res.status(429).json({ error: "Too many requests. Public API limit exceeded." });
  }

  record.count += 1;
  next();
};
