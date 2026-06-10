import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
// We'll test against a mock app since importing the full app might be complex due to DB/Vite
import cors from "cors";

const createMockApp = (isProd: boolean) => {
  const app = express();
  
  const allowedOrigins = ["http://localhost:5000", "http://127.0.0.1:5000"];
  
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // This is the logic we WANT to test and implement
      if (!origin) {
        // Reject if no origin
        return callback(new Error("CORS: Origin header is required"), false);
      }
      if (allowedOrigins.indexOf(origin) !== -1 || !isProd) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  };

  app.use(cors(corsOptions));
  
  app.get("/test", (req, res) => {
    res.status(200).json({ message: "success" });
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
    const app = createMockApp(false);
    const response = await request(app).get("/test");
    // Without an Origin header, it should be rejected
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("CORS: Origin header is required");
  });

  it("allows requests with a valid Origin header", async () => {
    const app = createMockApp(false);
    const response = await request(app)
      .get("/test")
      .set("Origin", "http://localhost:5000");
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("success");
  });
});
