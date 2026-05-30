import type { Express } from "express";
import type { Server } from "http";
import { storage, type AssessmentCreateInput } from "./storage";
import { requireAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { existsSync } from "fs";
import { writeFile, unlink } from "fs/promises";
import { randomUUID, createHash } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { rateLimit } from "express-rate-limit";

const execFileAsync = promisify(execFile);

/**
 * Tracks currently running inference requests to prevent
 * duplicate concurrent ML execution for identical payloads.
 */
const activeInferenceRequests = new Set<string>();

function generateRequestFingerprint(
  payload: unknown,
  userId: string,
): string {
  return createHash("sha256")
    .update(`${userId}::${JSON.stringify(payload)}`)
    .digest("hex");
}

// ESM-compatible path resolution for analyze.py
// Resolve relative to this source file, not process.cwd()
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const analyzePyPath = path.resolve(__dirname, "..", "analyze.py");

/**
 * Rate limiter for the ML assessment endpoint.
 * This endpoint spawns a Python subprocess for each request, which is resource-intensive.
 * Limits to 5 requests per minute per IP to prevent DoS attacks.
 */
const assessmentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 5, // 5 requests per IP per window
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many assessment requests. Please try again later.",
    retryAfter: 60, // seconds
  },
});

function getPythonExecutable() {
  const candidates = process.platform === "win32"
    ? [
        path.resolve(".venv", "Scripts", "python.exe"),
        path.resolve("venv", "Scripts", "python.exe")
      ]
    : [
        path.resolve(".venv", "bin", "python"),
        path.resolve("venv", "bin", "python")
      ];

  return candidates.find((candidate) => existsSync(candidate)) ?? "python3";
}

async function seedDatabase() {
  const existing = await storage.getAssessments();

  if (existing.length === 0) {
    console.log("Seeding database with sample assessments...");

    const samples: AssessmentCreateInput[] = [
      {
        gender: "Male",
        age: 45,
        hypertension: false,
        heartDisease: false,
        smokingHistory: "never",
        bmi: "24.5",
        hba1cLevel: "5.2",
        bloodGlucoseLevel: "95",
        riskScore: "12.3",
        riskCategory: "LOW",
        factors: [
          {
            name: "Age",
            impact: "positive",
            description: "Increases risk"
          },
          {
            name: "Bmi",
            impact: "negative",
            description: "Lowers risk"
          },
          {
            name: "Hba1c Level",
            impact: "negative",
            description: "Lowers risk"
          }
        ]
      },
      {
        gender: "Female",
        age: 62,
        hypertension: true,
        heartDisease: false,
        smokingHistory: "former",
        bmi: "31.2",
        hba1cLevel: "6.8",
        bloodGlucoseLevel: "145",
        riskScore: "48.7",
        riskCategory: "MODERATE",
        factors: [
          {
            name: "Hba1c Level",
            impact: "positive",
            description: "Increases risk"
          },
          {
            name: "Bmi",
            impact: "positive",
            description: "Increases risk"
          },
          {
            name: "Hypertension",
            impact: "positive",
            description: "Increases risk"
          }
        ]
      },
      {
        gender: "Male",
        age: 58,
        hypertension: true,
        heartDisease: true,
        smokingHistory: "current",
        bmi: "35.8",
        hba1cLevel: "8.2",
        bloodGlucoseLevel: "198",
        riskScore: "76.4",
        riskCategory: "HIGH",
        factors: [
          {
            name: "Hba1c Level",
            impact: "positive",
            description: "Increases risk"
          },
          {
            name: "Blood Glucose Level",
            impact: "positive",
            description: "Increases risk"
          },
          {
            name: "Heart Disease",
            impact: "positive",
            description: "Increases risk"
          }
        ]
      }
    ];

    for (const sample of samples) {
      await storage.createAssessment(sample);
    }

    console.log("Seeding complete!");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed database on startup — development only to prevent fake data in production
  if (process.env.NODE_ENV !== "production") {
    seedDatabase().catch(console.error);
  }

  app.post(
    api.assessments.preview.path,
    requireAuth,
    assessmentLimiter,
    async (req, res) => {
      try {
        const input = api.assessments.preview.input.parse(req.body);

        const tempFile = path.join(
          os.tmpdir(),
          `${randomUUID()}.json`
        );

        await writeFile(tempFile, JSON.stringify(input));

        try {
          const { stdout, stderr } = await execFileAsync(
            getPythonExecutable(),
            [analyzePyPath, "predict_file", tempFile],
            {
              timeout: 30000
            }
          );

          let prediction;

          try {
            prediction = JSON.parse(stdout.trim());
          } catch (e) {
            console.error(
              "Failed to parse python output (preview):",
              stdout,
              stderr
            );
            throw new Error("Failed to process prediction preview.");
          }

          if (prediction.error) {
            return res.status(400).json({
              message: prediction.error
            });
          }

          return res.json({
            riskScore: prediction.riskScore,
            riskCategory: prediction.riskCategory,
            factors: prediction.factors ?? [],
            confidenceInterval: prediction.confidenceInterval ?? null,
            modelConfidence: prediction.modelConfidence ?? null
          });
        } catch (error: any) {
          console.error("Python ML preview execution failed:", error);

          if (error.killed || error.signal === "SIGTERM") {
            return res.status(408).json({
              message: "Clinical assessment preview timed out."
            });
          }

          return res.status(500).json({
            message: "Failed to generate clinical preview."
          });
        } finally {
          try {
            await unlink(tempFile);
          } catch (e) {}
        }
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message
          });
        }

        console.error("Error creating assessment preview:", err);

        return res.status(500).json({
          message: "Internal server error"
        });
      }
    }
  );

  app.post(
    api.assessments.create.path,
    requireAuth,
    assessmentLimiter,
    async (req, res) => {
      let requestFingerprint: string | null = null;

      try {
        const input = api.assessments.create.input.parse(req.body);

        // Generate fingerprint for request deduplication
        const userId = req.session.user?.email;
        if (!userId) {
          return res.status(401).json({
            message: "Authentication required.",
          });
        }
        requestFingerprint = generateRequestFingerprint(input, userId);

        // Prevent duplicate concurrent inference execution
        if (activeInferenceRequests.has(requestFingerprint)) {
          return res.status(409).json({
            message:
              "An identical assessment request is already being processed."
          });
        }

        activeInferenceRequests.add(requestFingerprint);

        // Save input to a temporary file to pass to the Python script
        const tempFile = path.join(
          os.tmpdir(),
          `${randomUUID()}.json`
        );

        await writeFile(tempFile, JSON.stringify(input));

        try {
          // Call Python script to perform the logistic regression analysis
          const { stdout, stderr } = await execFileAsync(
            getPythonExecutable(),
            [analyzePyPath, "predict_file", tempFile],
            {
              timeout: 30000
            }
          );

          let prediction;

          try {
            prediction = JSON.parse(stdout.trim());

            if (prediction.error) {
              return res.status(400).json({
                message: prediction.error
              });
            }

          } catch (e) {
            console.error(
              "Failed to parse python output:",
              stdout,
              stderr
            );

            throw new Error("Failed to process prediction.");
          }

          // Ensure non-diagnostic framing in response
          prediction.disclaimer =
            "DISCLAIMER: This is a clinical decision support tool and is not a medical diagnosis. Please consult with a healthcare professional for clinical decisions.";

          // Save the assessment to the database
          const assessment = await storage.createAssessment({
            ...input,
            riskScore: String(prediction.riskScore),
            riskCategory: prediction.riskCategory,
            factors: prediction.factors,
            confidenceInterval: prediction.confidenceInterval,
            modelConfidence:
              prediction.modelConfidence == null
                ? undefined
                : String(prediction.modelConfidence),
            createdBy: userId
          });

          // Return both the DB assessment record and the rich prediction data
          res.status(201).json({
            ...assessment,
            prediction
          });

        } catch (error: any) {
          console.error("Python ML execution failed:", error);

          if (error.killed || error.signal === "SIGTERM") {
            return res.status(408).json({
              message: "Clinical assessment generation timed out."
            });
          }

          return res.status(500).json({
            message: "Failed to generate clinical assessment."
          });

        } finally {
          // Cleanup temporary file
          try {
            await unlink(tempFile);
          } catch (e) {}

          // Release active inference lock
          if (requestFingerprint) {
            activeInferenceRequests.delete(requestFingerprint);
          }
        }

      } catch (err) {
        // Release active inference lock on validation/runtime failure
        if (requestFingerprint) {
          activeInferenceRequests.delete(requestFingerprint);
        }

        if (err instanceof z.ZodError) {
          return res.status(400).json({
            message: err.errors[0].message
          });
        }

        console.error("Error creating assessment:", err);

        res.status(500).json({
          message: "Internal server error"
        });
      }
    }
  );

  app.get(api.assessments.list.path, requireAuth, async (req, res) => {
    try {
      const userEmail = req.session.user?.email;
      const assessments = await storage.getAssessments(50, 0, userEmail);

      res.json(assessments);

    } catch (err) {
      res.status(500).json({
        message: "Failed to fetch assessments"
      });
    }
  });

  return httpServer;
}
