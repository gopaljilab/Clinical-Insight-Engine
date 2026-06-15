import { z } from "zod";

/**
 * Standardized API error response shape.
 *
 * All endpoints should return `{ message: string }` for client-facing errors.
 * The optional `requestId` is included for unhandled exceptions traced by the
 * global error handler, enabling support to correlate client reports with
 * server-side logs.
 */
export const errorResponseSchema = z.object({
  message: z.string(),
  requestId: z.string().uuid().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Creates a standardized error response object for unhandled exceptions.
 */
export function createErrorResponse(message: string, requestId: string): ErrorResponse {
  return {
    message,
    requestId,
  };
}
