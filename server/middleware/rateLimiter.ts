import { Request, Response, NextFunction } from "express";

const requestStore = new Map<string, { count: number; resetTime: number }>();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 60;

export const publicApiRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
  const now = Date.now();
  const record = requestStore.get(ip as string);

  if (!record || now > record.resetTime) {
    requestStore.set(ip as string, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }

  if (record.count >= MAX_REQUESTS) {
    console.warn(`[RATE LIMIT EXCEEDED] DDoS protection triggered for IP: ${ip}`);
    return res.status(429).json({ error: "Too many requests. Public API limit exceeded." });
  }

  record.count += 1;
  next();
};
