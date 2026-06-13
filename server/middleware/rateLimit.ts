import { rateLimit } from "express-rate-limit";

// General API endpoints: 100 requests per minute
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 100, // Limit each IP to 100 requests per `window` (here, per 1 minute)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { message: "Too many requests, please try again later." }
});

// ML prediction endpoints: 20 requests per minute
export const mlLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 20, // Limit each IP to 20 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many prediction requests, please try again later." }
});

// Admin endpoints: 60 requests per minute
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 60, // Limit each IP to 60 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many admin requests, please try again later." }
});

// Export endpoints: 10 requests per minute
export const exportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // Limit each IP to 10 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many export requests, please try again later." }
});

// Assessment creation endpoints: 5 requests per window
export const assessmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // Limit each IP to 5 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many assessment requests, please try again later." }
});

// Assessment preview endpoints: 10 requests per window
export const previewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // Limit each IP to 10 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many preview requests, please try again later." }
});
