import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { writeFileSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function seedDatabase() {
  const existing = await storage.getAssessments();
  if (existing.length === 0) {
    console.log("Seeding database with sample assessments...");
    
    const samples = [
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
          { name: "Age", impact: "positive", description: "Increases risk" },
          { name: "Bmi", impact: "negative", description: "Lowers risk" },
          { name: "Hba1c Level", impact: "negative", description: "Lowers risk" }
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
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Bmi", impact: "positive", description: "Increases risk" },
          { name: "Hypertension", impact: "positive", description: "Increases risk" }
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
          { name: "Hba1c Level", impact: "positive", description: "Increases risk" },
          { name: "Blood Glucose Level", impact: "positive", description: "Increases risk" },
          { name: "Heart Disease", impact: "positive", description: "Increases risk" }
        ]
      }
    ];
    
    for (const sample of samples) {
      await storage.createAssessment(sample);
    }
    console.log("Seeding complete!");
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Seed database on startup
  seedDatabase().catch(console.error);
  
  app.post(api.assessments.create.path, async (req, res) => {
    try {
      const input = api.assessments.create.input.parse(req.body);
      
      // Save input to a temporary file to pass to the Python script
      const tempFile = `/tmp/${randomUUID()}.json`;
      writeFileSync(tempFile, JSON.stringify(input));
      
      try {
        // Call Python script to perform the logistic regression analysis
        const { stdout, stderr } = await execAsync(`python3 analyze.py predict_file ${tempFile}`);
        
        let prediction;
        try {
          prediction = JSON.parse(stdout.trim());
        } catch (e) {
          console.error("Failed to parse python output:", stdout, stderr);
          throw new Error("Failed to process prediction.");
        }
        
        // Save the assessment to the database
        const assessment = await storage.createAssessment({
          ...input,
          riskScore: String(prediction.riskScore),
          riskCategory: prediction.riskCategory,
          factors: prediction.factors
        });
        
        // Return both the DB assessment record and the rich prediction data (with advice)
        res.status(201).json({ ...assessment, prediction });
      } finally {
        try { unlinkSync(tempFile); } catch (e) {}
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Error creating assessment:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.assessments.list.path, async (req, res) => {
    try {
      const assessments = await storage.getAssessments();
      res.json(assessments);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch assessments" });
    }
  });

  return httpServer;
}
