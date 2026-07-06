/**
 * Wraps an asynchronous Express route handler and forwards
 * rejected promises to Express error-handling middleware.
 *
 * @param fn - Async Express route handler.
 * @returns Express request handler with automatic error forwarding.
 *
 * @example
 * router.get(
 *   "/users",
 *   asyncHandler(async (req, res) => {
 *     const users = await getUsers();
 *     res.json(users);
 *   })
 * );
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
): RequestHandler {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
