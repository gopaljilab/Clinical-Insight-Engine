import { Request, Response, NextFunction } from "express";

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
    
    console.log(JSON.stringify(logData));
    
    if (duration > 500 || res.statusCode >= 500) {
      console.warn(`[ANOMALY DETECTED] High latency or server error: ${req.method} ${req.path}`);
    }
  });
  
  next();
};
