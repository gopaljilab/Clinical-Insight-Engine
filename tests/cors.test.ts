import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { createCorsMiddleware } from "../server/middleware/cors";

const createMockApp = (isProd: boolean) => {
  const app = express();
  
  const allowedOrigins = ["http://localhost:5000", "http://127.0.0.1:5000"];
  
  app.use(createCorsMiddleware(allowedOrigins, isProd));
  
  app.get("/test", (req, res) => {
    res.status(200).json({ message: "success" });
  });
  app.get("/", (_req, res) => res.status(200).type("html").send("<main>SPA</main>"));
  app.get("/dashboard", (_req, res) => res.status(200).type("html").send("<main>SPA</main>"));
  app.get("/assets/app.js", (_req, res) => res.status(200).type("javascript").send("void 0;"));
  app.get("/api/assessments", (_req, res) => res.status(200).json({ ok: true }));
  app.post("/api/assessments", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/api/csrf-token", (_req, res) => res.status(200).json({ token: "test" }));
  app.get("/api/auth/me", (_req, res) => res.status(401).json({ message: "Not authenticated." }));
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Error handler for CORS errors
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.message === "CORS: Origin header is required" || err.message === "Not allowed by CORS") {
      res.status(403).json({ error: err.message });
    } else {
      next(err);
    }
  });

  return app;
};

describe("CORS Hardening", () => {
  it("rejects requests missing the Origin header", async () => {
    const app = createMockApp(true);
    const response = await request(app).get("/test");
    // Without an Origin header, it should be rejected
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("CORS: Origin header is required");
  });

  it("allows requests with a valid Origin header", async () => {
    const app = createMockApp(true);
    const response = await request(app)
      .get("/test")
      .set("Origin", "http://localhost:5000");
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("success");
  });

  it("allows originless navigation to the SPA root and registered pages", async () => {
    const app = createMockApp(true);
    const root = await request(app).get("/").set("Accept", "text/html");
    const page = await request(app).get("/dashboard").set("Accept", "text/html");
    expect(root.status).toBe(200);
    expect(page.status).toBe(200);
  });

  it("allows originless requests for built static assets", async () => {
    const app = createMockApp(true);
    const response = await request(app).get("/assets/app.js");
    expect(response.status).toBe(200);
  });

  it("does not allow originless navigation on arbitrary non-SPA routes", async () => {
    const app = createMockApp(true);
    const response = await request(app).get("/test").set("Accept", "text/html");
    expect(response.status).toBe(403);
  });

  it("rejects originless API POST requests in production", async () => {
    const app = createMockApp(true);
    const response = await request(app).post("/api/assessments");
    expect(response.status).toBe(403);
  });

  it("allows originless same-origin API reads to reach route authorization", async () => {
    const app = createMockApp(true);
    const csrf = await request(app).get("/api/csrf-token");
    const auth = await request(app).get("/api/auth/me");

    expect(csrf.status).toBe(200);
    expect(auth.status).toBe(401);
  });

  it("rejects a disallowed Origin on an API request", async () => {
    const app = createMockApp(true);
    const response = await request(app)
      .post("/api/assessments")
      .set("Origin", "https://unapproved.example");
    expect(response.status).toBe(403);
  });

  it("accepts an allowed Origin on an API request", async () => {
    const app = createMockApp(true);
    const response = await request(app)
      .post("/api/assessments")
      .set("Origin", "http://localhost:5000");
    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5000");
  });

  it("allows originless GET health checks in production without CORS headers", async () => {
    const app = createMockApp(true);
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("still rejects an unapproved Origin on the health endpoint", async () => {
    const app = createMockApp(true);
    const response = await request(app).get("/health").set("Origin", "https://unapproved.example");
    expect(response.status).toBe(403);
  });
});
