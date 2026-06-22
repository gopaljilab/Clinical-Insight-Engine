import type { Request, Response, NextFunction } from "express";
import { sanitizeDatabaseError } from "../security/sqlProtection";
import { logAuditEvent, generateRequestId } from "../services/security/auditLogger";
import { createErrorResponse } from "../../shared/schemas/errorResponse";
import { logger } from "../logger";
import { AppError } from "../utils/AppError";

/**
 * Global Exception Handler
 *
 * Responsibilities:
 * - Catch unhandled exceptions
 * - Sanitize responses to hide SQL, stack traces, and PII
 * - Log details internally with a requestId
 *
 * This MUST be mounted as the LAST middleware so it catches errors
 * from all preceding route handlers and middleware.
 */
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    return next(err);
  }

  // Handle CORS errors specifically (e.g. missing Origin, disallowed origin)
  if ((err as Error).message === "CORS: Origin header is required" || (err as Error).message === "Not allowed by CORS") {
    logger.warn({ err: { message: (err as Error).message, method: req.method, path: req.originalUrl } }, "CORS error rejected");
    return res.status(403).json({ message: (err as Error).message });
  }

  const requestId = generateRequestId();

  // 1. Log the full error internally — never send internals to clients
  logger.error({ err, requestId, method: req.method, path: req.originalUrl }, "Unhandled server error caught by globalErrorHandler");

  // 2. Database & ORM Error Sanitization
  // Prevents table names, SQL syntax, and pg error codes from leaking
  const { statusCode, message } = sanitizeDatabaseError(err);

  // 3. Determine final HTTP status code
  let finalStatus = statusCode;
  if (err instanceof AppError) {
    finalStatus = err.statusCode;
  } else if (
    (err as any)?.code &&
    typeof (err as any).code === "string" &&
    (err as any).code.length === 5
  ) {
    finalStatus = statusCode; // Postgres error
  } else if ((err as any)?.status || (err as any)?.statusCode) {
    finalStatus = (err as any).status ?? (err as any).statusCode;
  }

  // 4. Mask actual error if it's an unhandled 500
  // Ensure that generic Server Errors DO NOT expose their `message` to the client.
  let safeMessage = message;
  if (err instanceof AppError) {
    safeMessage = err.message;
  } else if (finalStatus === 500) {
    safeMessage = "An internal server error occurred";
  }

  // 5. Record security audit event
  logAuditEvent(
    "Unhandled API Exception",
    {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: finalStatus,
      exceptionType: (err as Error).name ?? typeof err,
      body: req.body, // The logger masks sensitive keys automatically
    },
    err
  );

  // 6. Return standardized response
  const responsePayload = createErrorResponse(safeMessage, requestId);

  return res.status(finalStatus).json(responsePayload);
}
