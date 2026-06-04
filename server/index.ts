import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import {
  DatabaseStartupError,
  verifyDatabaseConnection,
  closePool,
  getPool,
} from "./db";
import { registerRoutes } from "./routes";
import { createAuthRouter } from "./auth";
import patientsRouter from "./routes/patients";
import { serveStatic } from "./static";
import { sanitizeDatabaseError } from "./security/sqlProtection";
import { createServer } from "http";
import { loggingAnomalyMiddleware } from "./middleware/loggingAnomaly";
import { getPythonExecutable } from "./routes";
import { promisify } from "util";
import { execFile } from "child_process";

const execFileAsync = promisify(execFile);


const app = express();
const httpServer = createServer(app);
const REQUEST_BODY_LIMIT = "256kb";
const execFileAsync = promisify(execFile);

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
    store: new PgSession({
      pool: getPool(),
      tableName: "session",
      createTableIfMissing: true,
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
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

// Vite HMR requires eval in development mode
if (process.env.NODE_ENV !== "production") {
  scriptSrcDirective.push("'unsafe-eval'");
}

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

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  (req as any).id = requestId;
  res.setHeader("X-Request-ID", requestId);

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
        requestId,
        method: req.method,
        path,
        status: res.statusCode,
        duration,
        responseSummary: capturedJsonResponse ? summarizeApiResponse(capturedJsonResponse) : undefined,
      };
      log(JSON.stringify(logPayload));
    }
  });

  next();
});

(async () => {
  try {
    await verifyDatabaseConnection();
  } catch (error) {
    if (error instanceof DatabaseStartupError) {
      console.error(error.message);
    } else {
      console.error("Unexpected database startup error:", error);
    }

    await closePool();
    process.exit(1);
  }

  // Register auth routes BEFORE API routes so session is available
  app.use("/api/auth", createAuthRouter());
  // Warm up ML model at startup so first prediction request is fast
  log("Warming up ML model at startup...", "ml");
  execFileAsync(getPythonExecutable(), ["analyze.py", "train"])
    .then(() => log("ML model ready.", "ml"))
    .catch((err: any) => log(`ML warmup warning: ${err.message}`, "ml"));
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    // Log the full error internally for debugging, but never send internals to clients
    console.error("Unhandled server error:", err);

    // Sanitize database errors — prevents table names, SQL syntax, and pg error codes
    // from reaching the client response body
    const { statusCode, message } = sanitizeDatabaseError(err);

    // For non-DB errors (e.g. express body-parser), fall back to err.status
    const finalStatus = (err?.code && typeof err.code === "string" && err.code.length === 5)
      ? statusCode                            // PostgreSQL error code (5-char alphanumeric)
      : (err?.status ?? err?.statusCode ?? statusCode);

    return res.status(finalStatus).json({ message });
  });

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

  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on ${host}:${port}`);
    }
  );

  // Graceful shutdown handler
  function shutdown(signal: string) {
    log(`${signal} received — shutting down gracefully`);

    httpServer.close(async () => {
      log("HTTP server closed");
      await closePool();
      log("Database pool closed");
      process.exit(0);
    });

    // Force exit if graceful shutdown takes too long
    setTimeout(() => {
      console.error("Graceful shutdown timed out — forcing exit");
      process.exit(1);
    }, 10000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();


// GSSoC Issue #687 Patch
    // GSSoC Issue #687 exit process on DB fail
    process.exit(1);
