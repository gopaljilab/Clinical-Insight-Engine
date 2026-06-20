import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import { createServer } from "http";

// Mock rate limit
vi.mock("express-rate-limit", () => {
  const rateLimit = () => (req: any, res: any, next: any) => next();
  return { rateLimit, default: rateLimit };
});

const mockSelect = vi.fn();
const mockDb = {
  select: mockSelect,
};

vi.mock("../db", () => ({
  getDb: vi.fn(() => mockDb),
  verifyDatabaseConnection: vi.fn().mockResolvedValue(undefined),
  closePool: vi.fn().mockResolvedValue(undefined),
  getPool: vi.fn(),
  DatabaseStartupError: class DatabaseStartupError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "DatabaseStartupError";
    }
  },
}));

vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { registerRoutes } from "../routes";

async function createAuthenticatedApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use((req, res, next) => {
    req.session.user = {
      id: "test-user-id",
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
    };
    next();
  });
  await registerRoutes(createServer(), app);
  return app;
}

async function createUnauthenticatedApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: "test-secret",
      resave: false,
      saveUninitialized: false,
    })
  );
  await registerRoutes(createServer(), app);
  return app;
}

describe("POST /api/assessments/check-duplicates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    const app = await createUnauthenticatedApp();
    const res = await request(app)
      .post("/api/assessments/check-duplicates")
      .send({ assessments: [] });
    expect(res.status).toBe(401);
  });

  it("returns empty duplicates when no assessments are passed", async () => {
    const app = await createAuthenticatedApp();
    const res = await request(app)
      .post("/api/assessments/check-duplicates")
      .send({ assessments: [] });
    expect(res.status).toBe(200);
    expect(res.body.duplicates).toEqual([]);
  });

  it("returns duplicate assessments found in db", async () => {
    const mockDbResult = [
      {
        patientName: "John Doe",
        age: 45,
        gender: "Male",
      },
    ];

    const mockWhere = vi.fn().mockResolvedValue(mockDbResult);
    const mockFrom = vi.fn(() => ({ where: mockWhere }));
    mockSelect.mockImplementation(() => ({ from: mockFrom }));

    const app = await createAuthenticatedApp();
    const res = await request(app)
      .post("/api/assessments/check-duplicates")
      .send({
        assessments: [
          { patientName: "John Doe", age: 45, gender: "Male" },
          { patientName: "Jane Smith", age: 30, gender: "Female" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.duplicates).toEqual(mockDbResult);
    expect(mockSelect).toHaveBeenCalled();
  });
});
