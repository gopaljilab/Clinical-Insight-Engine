import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";

export const loggingAnomalyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip
    };
    
    logger.info(logData, "Request logged (Anomaly Middleware)");
    
    if (duration > 500 || res.statusCode >= 500) {
      logger.warn({ anomaly: true, path: req.path }, "High latency or server error");
    }
  });
  
  next();
};
