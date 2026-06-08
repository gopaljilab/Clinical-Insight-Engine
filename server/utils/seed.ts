import { logger } from "../logger";
import { storage, type AssessmentCreateInput } from "../storage";

export async function seedDatabase() {
  const existing = await storage.getAssessments(1); // just need to check if any exist
  
  // existing.data is used in the codebase if cursor pagination returned data wrapper, or just checking length.
  // Wait, in my cursor pagination logic it might return an array or an object. Let's just check length of what we get.
  if (Array.isArray(existing) && existing.length > 0) return;
  if (!Array.isArray(existing) && existing.data && existing.data.length > 0) return;

  logger.info("Seeding database with sample assessments...");

  const seedUserId = "seed@clinical-insight-engine.dev";

  const samples: AssessmentCreateInput[] = [
    {
      createdBy: seedUserId,
      patientName: "John Doe",
      gender: "Male",
      age: 45,
      hypertension: false,
      heartDisease: false,
      smokingHistory: "never",
      bmi: 24.5,
      hba1cLevel: 5.2,
      bloodGlucoseLevel: 95,
      riskScore: 12.3,
      riskCategory: "LOW",
      factors: [
        { name: "Age", impact: "positive", description: "Increases risk" },
        { name: "Bmi", impact: "negative", description: "Lowers risk" },
        {
          name: "Hba1c Level",
          impact: "negative",
          description: "Lowers risk",
        },
      ],
      confidenceInterval: "8.5% - 16.1%",
      modelConfidence: 0.877,
    },
    {
      createdBy: seedUserId,
      patientName: "Mary Johnson",
      gender: "Female",
      age: 62,
      hypertension: true,
      heartDisease: false,
      smokingHistory: "former",
      bmi: 31.2,
      hba1cLevel: 6.8,
      bloodGlucoseLevel: 145,
      riskScore: 48.7,
      riskCategory: "MODERATE",
      factors: [
        {
          name: "Hba1c Level",
          impact: "positive",
          description: "Increases risk",
        },
        { name: "Bmi", impact: "positive", description: "Increases risk" },
        {
          name: "Hypertension",
          impact: "positive",
          description: "Increases risk",
        },
      ],
      confidenceInterval: "38.9% - 58.5%",
      modelConfidence: 0.513,
    },
  ];

  for (const sample of samples) {
    await storage.createAssessment(sample);
  }

  logger.info("Seeding complete!");
}
