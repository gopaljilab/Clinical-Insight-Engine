import type { Express, NextFunction, Request, Response } from "express";

// Optional dependency gating: this project should still run even if the
// OpenAPI tooling dependencies are not installed.
let swaggerUi: any;
let extendZodWithOpenApi: any;
let OpenAPIRegistry: any;
let OpenApiGeneratorV3: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  swaggerUi = require("swagger-ui-express");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ({ extendZodWithOpenApi, OpenAPIRegistry, OpenApiGeneratorV3 } = require("@asteasolutions/zod-to-openapi"));
} catch {
  swaggerUi = null;
}

import { z } from "zod";
import { loginDTOSchema } from "./validation/auth.dto";
import { api } from "../shared/routes";

if (extendZodWithOpenApi) {
  extendZodWithOpenApi(z);
}

const swaggerUiOptions = {

  customSiteTitle: "Clinical Insight Engine API Docs",
  swaggerOptions: {
    persistAuthorization: true,
  },
};

const registry = OpenAPIRegistry ? new OpenAPIRegistry() : null;


if (registry) {
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
}

const errorResponseSchema = registry?.register(
  "ErrorResponse",
  z.object({
    message: z.string(),
  })
);

const loginRequestSchema = registry?.register("LoginRequest", loginDTOSchema);

const loginResponseSchema = registry?.register(
  "LoginResponse",
  z.object({
    success: z.boolean(),
    pendingEmail: z.string().email(),
  })
);

const currentUserResponseSchema = registry?.register(
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

registry?.registerPath({
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

registry?.registerPath({
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

registry?.registerPath({
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
function registerEndpoint(operationId: string, endpoint: any) {
  const responses: any = {};
  
  if (endpoint.responses) {
    for (const [statusCode, schema] of Object.entries(endpoint.responses)) {
      responses[statusCode] = {
        description: `${statusCode} Response`,
        content: {
          "application/json": {
            schema: schema as z.ZodTypeAny
          }
        }
      };
    }
  }

  // Parse path parameters (e.g., :id -> {id})
  const pathParams: Record<string, z.ZodString> = {};
  let openApiPath = endpoint.path;
  
  const pathParamMatches = endpoint.path.match(/:([a-zA-Z0-9_]+)/g);
  if (pathParamMatches) {
    for (const match of pathParamMatches) {
      const paramName = match.substring(1);
      openApiPath = openApiPath.replace(match, `{${paramName}}`);
      pathParams[paramName] = z.string();
    }
  }

  const request: any = {};
  if (Object.keys(pathParams).length > 0) {
    request.params = z.object(pathParams);
  }
  
  if (endpoint.input) {
    request.body = {
      content: {
        "application/json": {
          schema: endpoint.input as z.ZodTypeAny
        }
      }
    };
  }

  registry?.registerPath({
    method: endpoint.method.toLowerCase(),
    path: openApiPath,
    operationId,
    request: Object.keys(request).length > 0 ? request : undefined,
    responses,
  });
}

function registerRoutes(apiObj: any) {
  for (const groupKey of Object.keys(apiObj)) {
    const group = apiObj[groupKey];
    for (const endpointKey of Object.keys(group)) {
      const endpoint = group[endpointKey];
      
      if (!endpoint.method && !endpoint.path) {
        for (const subKey of Object.keys(endpoint)) {
           const subEndpoint = endpoint[subKey];
           if (subEndpoint.method && subEndpoint.path) {
              registerEndpoint(`${groupKey}.${endpointKey}.${subKey}`, subEndpoint);
           }
        }
      } else {
        registerEndpoint(`${groupKey}.${endpointKey}`, endpoint);
      }
    }
  }
}

registerRoutes(api);

const generator = OpenApiGeneratorV3 ? new OpenApiGeneratorV3(registry?.definitions || []) : null;

export const openApiDocument = generator ? generator.generateDocument({
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
}) : {};

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

  if (swaggerUi) {
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
}
