import crypto from "crypto";
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
import { serveStatic } from "./static";
import { createServer } from "http";
import { loggingAnomalyMiddleware } from "./middleware/loggingAnomaly";

const app = express();
const httpServer = createServer(app);
const REQUEST_BODY_LIMIT = "256kb";

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
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${summarizeApiResponse(capturedJsonResponse)}`;
      }

      log(logLine);
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

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
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
