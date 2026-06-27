import { Request, Response, NextFunction } from "express";
import { ZodTypeAny, ZodError } from "zod";
import { logger } from "../logger";

export const validateDTO = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate and sanitize incoming request body
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ err: error, path: req.path }, "DTO Validation failed");
        return res.status(400).json({
          message: "Validation failed.",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: (err as unknown as Error).message
          }))
        });
      }
      logger.error({ err: error }, "Unexpected error in validateDTO");
      return res.status(500).json({ message: "Internal server error during validation" });
    }
  };
};

export const validateQueryDTO = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query) as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ err: error, path: req.path }, "Query DTO Validation failed");
        return res.status(400).json({
          message: "Validation failed.",
          errors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: (err as unknown as Error).message
          }))
        });
      }
      return res.status(500).json({ message: "Internal server error during query validation" });
    }
  };
};
