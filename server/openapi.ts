import type { Express, NextFunction, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { loginDTOSchema } from "./validation/auth.dto";

extendZodWithOpenApi(z);

const swaggerUiOptions = {
  customSiteTitle: "Clinical Insight Engine API Docs",
  swaggerOptions: {
    persistAuthorization: true,
  },
};

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "SessionAuth", {
  type: "apiKey",
  in: "cookie",
  name: "connect.sid",
  description: "Authenticated Express session cookie.",
});

registry.registerComponent("securitySchemes", "BearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "JWT issued by GET /api/auth/token.",
});

const errorResponseSchema = registry.register(
  "ErrorResponse",
  z.object({
    message: z.string(),
  })
);

const loginRequestSchema = registry.register("LoginRequest", loginDTOSchema);

const loginResponseSchema = registry.register(
  "LoginResponse",
  z.object({
    success: z.boolean(),
    pendingEmail: z.string().email(),
  })
);

const currentUserResponseSchema = registry.register(
  "CurrentUserResponse",
  z.object({
    user: z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
      role: z.string().nullable().optional(),
      emailVerified: z.boolean(),
    }),
  })
);

registry.registerPath({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Health check",
  responses: {
    200: {
      description: "Service health status.",
      content: {
        "application/json": {
          schema: z.object({
            status: z.literal("ok"),
            timestamp: z.string().datetime(),
            uptime: z.number(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/auth/login",
  tags: ["Authentication"],
  summary: "Start clinician login",
  description:
    "Validates clinician credentials and starts an OTP-backed pending session.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: loginRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Login credentials accepted; OTP verification is required.",
      content: {
        "application/json": {
          schema: loginResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid request body.",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: "Invalid credentials.",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/auth/me",
  tags: ["Authentication"],
  summary: "Get current clinician session",
  security: [{ SessionAuth: [] }, { BearerAuth: [] }],
  responses: {
    200: {
      description: "Current authenticated user.",
      content: {
        "application/json": {
          schema: currentUserResponseSchema,
        },
      },
    },
    401: {
      description: "No active authenticated session.",
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "Clinical Insight Engine API",
    version: "1.0.0",
    description:
      "Foundational OpenAPI documentation for the Clinical Insight Engine API.",
  },
  servers: [
    {
      url: "/",
      description: "Current server",
    },
  ],
});

function swaggerDocsCsp(_req: Request, res: Response, next: NextFunction) {
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src 'none'",
      "object-src 'none'",
    ].join("; ")
  );
  next();
}

export function registerOpenApiDocs(app: Express) {
  app.get("/api-docs/openapi.json", (_req, res) => {
    res.json(openApiDocument);
  });

  app.get(
    "/api-docs",
    swaggerDocsCsp,
    swaggerUi.setup(openApiDocument, swaggerUiOptions)
  );

  app.use(
    "/api-docs",
    swaggerDocsCsp,
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, swaggerUiOptions)
  );
}
