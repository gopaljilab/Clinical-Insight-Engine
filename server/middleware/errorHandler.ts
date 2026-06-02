import type { Request, Response, NextFunction } from "express";
import { sanitizeDatabaseError } from "../security/sqlProtection";
import { logAuditEvent, generateRequestId } from "../services/security/auditLogger";
import { createErrorResponse } from "../../shared/schemas/errorResponse";

/**
 * Global Exception Handler
 *
 * Responsibilities:
 * - Catch unhandled exceptions
 * - Sanitize responses to hide SQL, stack traces, and PII
 * - Log details internally with a requestId
 */
export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) {
    return next(err);
  }

  const requestId = generateRequestId();

  // 1. Database & ORM Error Sanitization
  // Prevents table names, SQL syntax, and pg error codes from leaking
  const { statusCode, message } = sanitizeDatabaseError(err);

  // 2. Determine final HTTP status code
  const finalStatus =
    err?.code && typeof err.code === "string" && err.code.length === 5
      ? statusCode
      : err?.status ?? err?.statusCode ?? statusCode;

  // 3. Mask actual error if it's an unhandled 500
  // Ensure that generic Server Errors DO NOT expose their `message` to the client.
  let safeMessage = message;
  if (finalStatus === 500 && process.env.NODE_ENV === "production") {
    safeMessage = "An internal server error occurred";
  } else if (finalStatus === 500) {
    // Even in non-production, unless we are debugging, hide it.
    safeMessage = "An internal server error occurred";
  }

  // 4. Log the full details securely internally
  logAuditEvent(
    "Unhandled API Exception",
    {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: finalStatus,
      exceptionType: err?.name ?? typeof err,
      body: req.body, // The logger masks sensitive keys automatically
    },
    err
  );

  // 5. Return standardized, generic response
  const responsePayload = createErrorResponse(safeMessage, requestId);

  return res.status(finalStatus).json(responsePayload);
}
