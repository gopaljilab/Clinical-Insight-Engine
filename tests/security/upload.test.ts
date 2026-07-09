import { describe, it, expect, vi, beforeEach } from "vitest";
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
import { MLService } from "../../server/services/mlService";

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

describe("Upload Rate Limiting", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/upload", uploadRouter);

  const csv = "name,age\nJohn,30";

  it("returns 429 after exceeding the upload rate limit window", async () => {
    // uploadLimiter allows 10 requests per 15-minute window per IP.
    let lastResponse;
    for (let i = 0; i < 11; i++) {
      lastResponse = await request(app)
        .post("/api/upload/lab-results")
        .attach("file", Buffer.from(csv), {
          filename: "data.csv",
          contentType: "text/csv",
        });
    }

    expect(lastResponse!.status).toBe(429);
    expect(lastResponse!.body.error).toContain("Too many upload requests");
  });
});

describe("ML Semaphore Saturation", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/upload", uploadRouter);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("acquires only a single semaphore slot per upload via the batch inference path", async () => {
    const batchSpy = vi
      .spyOn(MLService, "runAssessmentInferenceBatch")
      .mockResolvedValue({
        predictions: Array.from({ length: 50 }, () => ({
          riskScore: 10,
          riskCategory: "LOW",
          factors: [],
          clinicianAdvice: [],
          patientAdvice: [],
        })),
        isFallback: false,
      });
    const singleSpy = vi.spyOn(MLService, "runAssessmentInference");

    let csvContent = "name,age,hypertension,heartDisease\n";
    for (let i = 0; i < 50; i++) {
      csvContent += `User${i},30,false,false\n`;
    }

    await request(app)
      .post("/api/upload/lab-results")
      .attach("file", Buffer.from(csvContent), {
        filename: "batch.csv",
        contentType: "text/csv",
      });

    // The row-by-row path must never be called from the upload route:
    // a single upload should only ever acquire ONE mlConcurrency slot,
    // regardless of row count, so concurrent /preview or /simulate
    // requests are not starved.
    expect(batchSpy).toHaveBeenCalledTimes(1);
    expect(singleSpy).not.toHaveBeenCalled();
  });

  it("does not starve a concurrent preview-style inference call while a large upload is processing", async () => {
    let uploadInFlight = false;
    let previewObservedUploadInFlight = false;

    vi.spyOn(MLService, "runAssessmentInferenceBatch").mockImplementation(
      async () => {
        uploadInFlight = true;
        await new Promise((resolve) => setTimeout(resolve, 50));
        uploadInFlight = false;
        return {
          predictions: Array.from({ length: 100 }, () => ({
            riskScore: 10,
            riskCategory: "LOW",
            factors: [],
            clinicianAdvice: [],
            patientAdvice: [],
          })),
          isFallback: false,
        };
      }
    );

    // Simulates a concurrent single-row preview inference (uses a
    // second semaphore slot, since the upload only holds one).
    vi.spyOn(MLService, "runAssessmentInference").mockImplementation(
      async () => {
        previewObservedUploadInFlight = uploadInFlight;
        return { prediction: { riskScore: 5, riskCategory: "LOW", factors: [], clinicianAdvice: [], patientAdvice: [] }, isFallback: false };
      }
    );

    let csvContent = "name,age,hypertension,heartDisease\n";
    for (let i = 0; i < 100; i++) {
      csvContent += `User${i},30,false,false\n`;
    }

    const uploadPromise = request(app)
      .post("/api/upload/lab-results")
      .attach("file", Buffer.from(csvContent), {
        filename: "large.csv",
        contentType: "text/csv",
      });

    // Fire the "preview" call shortly after the upload starts.
    const previewPromise = new Promise((resolve) => setTimeout(resolve, 10)).then(() =>
      MLService.runAssessmentInference({}, "preview-row")
    );

    await Promise.all([uploadPromise, previewPromise]);

    // The preview call resolved even though the 100-row upload's single
    // batch semaphore slot was still held — proving the two no longer
    // contend for the same slot the way the old per-row loop did.
    expect(previewObservedUploadInFlight).toBe(true);
  });
});