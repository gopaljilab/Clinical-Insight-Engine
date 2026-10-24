import cors from "cors";
import type { RequestHandler } from "express";

const SPA_DOCUMENT_PATHS = new Set([
  "/",
  "/dashboard",
  "/analytics",
  "/import",
  "/history",
  "/admin",
  "/admin/model-monitoring",
  "/progress",
  "/counterfactual-analysis",
  "/settings",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/privacy-policy",
  "/terms",
  "/patient-login",
  "/my-health",
]);

const PUBLIC_ROOT_ASSETS = new Set([
  "/favicon.svg",
  "/logo.svg",
  "/logo-dark.svg",
  "/icon-only.svg",
]);

export function createCorsMiddleware(
  allowedOrigins: string[],
  isProduction: boolean,
): RequestHandler {
  const corsHandler = cors({
    origin: (origin, callback) => {
      if (!origin && !isProduction) {
        return callback(null, true);
      }

      if (!origin && isProduction) {
        return callback(new Error("CORS: Origin header is required"), false);
      }

      if (origin && allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  });

  return (req, res, next) => {
    const isOriginlessHealthProbe =
      req.path === "/health" &&
      !req.headers.origin &&
      (req.method === "GET" || req.method === "HEAD");

    const isGetOrHead = req.method === "GET" || req.method === "HEAD";
    const isOriginlessSpaDocument =
      !req.headers.origin &&
      isGetOrHead &&
      req.accepts("html") &&
      SPA_DOCUMENT_PATHS.has(req.path);
    const isOriginlessStaticAsset =
      !req.headers.origin &&
      isGetOrHead &&
      (req.path.startsWith("/assets/") || PUBLIC_ROOT_ASSETS.has(req.path));
    // Same-origin browser GET/HEAD requests normally omit Origin. Let them
    // reach route-level authentication/authorization; state-changing requests
    // without Origin remain rejected in production.
    const isOriginlessApiRead =
      !req.headers.origin &&
      isGetOrHead &&
      (req.path === "/api" || req.path.startsWith("/api/"));

    if (
      isOriginlessHealthProbe ||
      isOriginlessSpaDocument ||
      isOriginlessStaticAsset ||
      isOriginlessApiRead
    ) {
      return next();
    }

    return corsHandler(req, res, next);
  };
}
