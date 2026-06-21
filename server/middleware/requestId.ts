import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { requestContext } from "../logger";

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const reqId = (req.headers["x-request-id"] as string) || randomUUID();
  
  // Expose it on the response so clients can log/trace it
  res.setHeader("X-Request-ID", reqId);
  
  // Attach it to the request object for convenience
  (req).id = reqId;

  // Run the rest of the request within the async context
  requestContext.run(reqId, () => {
    next();
  });
}
