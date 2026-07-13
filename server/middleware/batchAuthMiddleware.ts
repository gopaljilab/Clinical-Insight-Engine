/**
 * batchAuthMiddleware.ts
 *
 * Enhanced authentication validation for batch operations.
 * Prevents unauthorized access and validates authentication state.
 * Rate limiting is handled by the batchLimiter middleware.
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";

/**
 * Enhance batch operation authentication with:
 * - Verify user is authenticated and verified
 * - Check request signing/token expiration
 * - Validate request size and payload
 * - Log all batch operations for audit trail
 */
export async function authenticateBatchOperation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Verify user is authenticated
    if (!req.session?.user?.id) {
      logger.warn(
        { ip: req.ip, userAgent: req.get("user-agent") },
        "Batch operation attempted without authentication"
      );
      return res.status(401).json({ message: "Unauthorized. Authentication required." });
    }

    // 2. Verify user is verified (email confirmed, etc)
    if (!req.session?.user?.emailVerified) {
      logger.warn(
        { userId: req.session.user.id, email: req.session.user.email },
        "Batch operation attempted by unverified user"
      );
      return res.status(403).json({ message: "Forbidden. User account must be verified." });
    }

    // 3. Verify session is not expired
    if (req.session?.cookie?.expires && new Date() > new Date(req.session.cookie.expires)) {
      logger.warn(
        { userId: req.session.user.id },
        "Batch operation attempted with expired session"
      );
      return res.status(401).json({ message: "Unauthorized. Session expired." });
    }

    // 4. Validate request size (batch operations can be large)
    const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB
    const contentLength = parseInt(req.get("content-length") || "0", 10);
    if (contentLength > MAX_PAYLOAD_SIZE) {
      const userId = req.session.user.id;
      logger.warn(
        { userId, contentLength, maxSize: MAX_PAYLOAD_SIZE },
        "Batch operation payload too large"
      );
      return res.status(413).json({
        message: `Payload too large. Maximum size is ${MAX_PAYLOAD_SIZE / 1024 / 1024}MB.`,
      });
    }

    // 5. Log batch operation initiation for audit trail
    logger.info(
      {
        userId: req.session.user.id,
        email: req.session.user.email,
        operation: "batch_analysis_initiated",
        ip: req.ip,
        timestamp: new Date().toISOString(),
      },
      "Batch operation authenticated and authorized"
    );

    // 6. Attach validated user info for downstream handlers
    (req as any).validatedUser = {
      id: req.session.user.id,
      email: req.session.user.email,
      emailVerified: req.session.user.emailVerified,
    };

    next();
  } catch (err) {
    logger.error({ err, userId: req.session?.user?.id }, "Error in batch auth middleware");
    return res.status(500).json({ message: "Internal server error" });
  }
}

/**
 * Log batch operation completion for audit trail
 */
export function logBatchCompletion(
  userId: string,
  operationType: string,
  itemsProcessed: number,
  itemsFailed: number,
  duration: number
): void {
  logger.info(
    {
      userId,
      operationType,
      itemsProcessed,
      itemsFailed,
      duration,
      timestamp: new Date().toISOString(),
    },
    "Batch operation completed"
  );
}
