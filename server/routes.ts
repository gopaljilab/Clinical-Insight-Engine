import type { Express } from "express";
import type { Server } from "http";
import authRouter from "./routes/auth.routes";
import assessmentsRouter from "./routes/assessments.routes";
import { seedDatabase } from "./utils/seed";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  if (process.env.NODE_ENV !== "production") {
    seedDatabase().catch(console.error);
  }

  // Mount domain-specific routers
  app.use("/api/auth", authRouter);
  app.use("/api/assessments", assessmentsRouter);

  return httpServer;
}
