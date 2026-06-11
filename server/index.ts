import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import {
  DatabaseStartupError,
  verifyDatabaseConnection,
  closePool,
  getPool,
} from "./db";
import { registerRoutes } from "./routes";
import { createAuthRouter } from "./auth";
import { getPythonExecutable } from "./services/mlService";
import patientsRouter from "./routes/patients";
import patientPortalRouter from "./routes/patient.routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { loggingAnomalyMiddleware } from "./middleware/loggingAnomaly";
import { globalErrorHandler } from "./middleware/errorHandler";
import { logger } from "./logger";
import { requestIdMiddleware } from "./middleware/requestId";
import {
  verifyRedisConnection,
  startAssessmentWorker,
  closeQueue,
} from "./queue";
import { EmailConfigurationError, validateEmailConfig } from "./email";
import { generalLimiter } from "./middleware/rateLimit";

const execFileAsync = promisify(execFile);
const app = express();
const httpServer = createServer(app);

// CORS configuration - hardened to reject requests missing the Origin header
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(",") 
  : [process.env.APP_URL, process.env.API_URL, "http://localhost:5000", "http://127.0.0.1:5000", "http://localhost:3000", "http://127.0.0.1:3000"].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    // This is required for the browser to load the initial HTML document
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"), false);
    }
  },
  credentials: true,
}));

const REQUEST_BODY_LIMIT = "10kb";
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", true);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express" {
  interface Locals {
    cspNonce: string;
  }
}

const PgSession = connectPgSimple(session);

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production.");
  }

  return "clinical-insight-engine-dev-secret";
}

app.use(
  session({
    secret: getSessionSecret(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: new PgSession({
      pool: getPool(),
      tableName: "session",
      createTableIfMissing: true,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes
    },
  })
);

app.use(
  express.json({
    limit: REQUEST_BODY_LIMIT,
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false, limit: REQUEST_BODY_LIMIT }));
app.use(requestIdMiddleware);
app.use(loggingAnomalyMiddleware);

// Nonce middleware - generates a unique cryptographic nonce per request for CSP
app.use((_req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("hex");
  next();
});

// Security headers via helmet
const scriptSrcDirective: Array<string | ((req: any, res: any) => string)> = [
  "'self'",
  (_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`,
];



app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: scriptSrcDirective,
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "ws://localhost:*", "ws://127.0.0.1:*"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

function summarizeApiResponse(body: Record<string, any>) {
  if (!body || typeof body !== "object") {
    return "[non-object response]";
  }

  return `[response keys: ${Object.keys(body).join(", ") || "none"}]`;
}



app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logPayload = {
        requestId: (req as any).id,
        method: req.method,
        path,
        status: res.statusCode,
        duration,
        responseSummary: capturedJsonResponse ? summarizeApiResponse(capturedJsonResponse) : undefined,
      };
      logger.info(logPayload, "API request completed");
    }
  });

  next();
});

(async () => {
  try {
    await verifyDatabaseConnection();
  } catch (error) {
    if (error instanceof DatabaseStartupError) {
      logger.error({ err: error }, error.message);
    } else {
      logger.error({ err: error }, "Unexpected database startup error");
    }

    await closePool();
    process.exit(1);
  }

  try {
    validateEmailConfig();
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      logger.error({ err: error }, error.message);
    } else {
      logger.error({ err: error }, "Unexpected email configuration error");
    }

    await closePool();
    process.exit(1);
  }

  const queueReady = await verifyRedisConnection();
  if (queueReady) {
    startAssessmentWorker();
    logger.info({ source: "redis" }, "Assessment queue ready.");
  } else {
    logger.warn({ source: "redis" }, "Redis unavailable — async assessment queue disabled.");
  }

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests from this IP, please try again later." }
  });
  
  app.use("/api", apiLimiter);

  // Register auth routes BEFORE API routes so session is available
  app.use("/api/auth", createAuthRouter());
  // Register protected patient EMR/EHR integration endpoints
  app.use("/api/patients", generalLimiter, patientsRouter);
  app.use("/api/patient", patientPortalRouter);
  // Warm up ML model at startup so first prediction request is fast
  logger.info({ source: "ml" }, "Warming up ML model at startup...");
  execFileAsync(getPythonExecutable(), ["analyze.py", "train"])
    .then(() => logger.info({ source: "ml" }, "ML model ready."))
    .catch((err: any) => logger.warn({ source: "ml" }, `ML warmup warning: ${err.message}`));
  await registerRoutes(httpServer, app);

  // Global error handler — must be the LAST middleware.
  // Handles CORS errors, database errors, unhandled exceptions, and returns
  // a consistent { message, requestId } shape for all error responses.
  app.use(globalErrorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT.
  // Other ports are firewalled. Default to 5000 if not specified.
  // This serves both the API and the client on the only un-firewalled port.
  // Bind to 0.0.0.0 by default so local containers, Replit, and deployed
  // environments expose the same listener. Set HOST=127.0.0.1 for local-only use.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "0.0.0.0";

  httpServer.on("error", async (error) => {
    logger.error({ err: error }, "Server startup failed");
    await closePool();
    process.exit(1);
  });

  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      logger.info({ source: "express" }, `serving on ${host}:${port}`);
    }
  );

  // Graceful shutdown handler
  function shutdown(signal: string) {
    logger.info({ source: "express" }, `${signal} received — shutting down gracefully`);

    httpServer.close(async () => {
      logger.info({ source: "express" }, "HTTP server closed");
      await closeQueue();
      logger.info({ source: "express" }, "Assessment queue closed");
      await closePool();
      logger.info({ source: "express" }, "Database pool closed");
      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      logger.error("Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, 10000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
