import { z } from "zod";

export const errorResponseSchema = z.object({
  error: z.string(),
  requestId: z.string().uuid(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Creates a standardized error response object.
 */
export function createErrorResponse(message: string, requestId: string): ErrorResponse {
  return {
    error: message,
    requestId,
  };
}
