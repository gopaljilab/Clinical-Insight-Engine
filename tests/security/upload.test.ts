import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

// Mock auth middleware before importing uploadRouter
vi.mock("../../server/auth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    req.session = { user: { id: "test-user", email: "test@example.com" } };
    next();
  },
  requireVerified: (req: any, res: any, next: any) => next(),
}));

import uploadRouter from "../../server/routes/upload.routes";

describe("File Upload Hardening", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/upload", uploadRouter);

  it("rejects executable files (.sh)", async () => {
    const response = await request(app)
      .post("/api/upload/lab-results")
      .attach("file", Buffer.from("echo 'hello'"), "script.sh");
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid file type");
  });

  it("rejects executable files (.js)", async () => {
    const response = await request(app)
      .post("/api/upload/lab-results")
      .attach("file", Buffer.from("console.log('hello')"), "malicious.js");
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid file type");
  });

  it("rejects PDF files (only CSV allowed)", async () => {
    const response = await request(app)
      .post("/api/upload/lab-results")
      .attach("file", Buffer.from("%PDF-1.4"), "test.pdf");
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Invalid file type. Only CSV files are allowed.");
  });

  it("accepts CSV files", async () => {
    const response = await request(app)
      .post("/api/upload/lab-results")
      .attach("file", Buffer.from("name,age\nJohn,30"), {
        filename: "data.csv",
        contentType: "text/csv"
      });
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Lab results imported successfully");
  });

  it("rejects files that are too large", async () => {
    // 6MB buffer (limit is 5MB)
    const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 'a');
    const response = await request(app)
      .post("/api/upload/lab-results")
      .attach("file", largeBuffer, "large.csv");
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain("File too large");
  });

  it("rejects CSV files with more than 100 rows", async () => {
    let csvContent = "name,age\n";
    for (let i = 0; i < 101; i++) {
      csvContent += `User${i},30\n`;
    }
    const response = await request(app)
      .post("/api/upload/lab-results")
      .attach("file", Buffer.from(csvContent), {
        filename: "too_many_rows.csv",
        contentType: "text/csv"
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toBe("CSV exceeds maximum limit of 100 rows.");
  });
});

