import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type AssessmentFactor = {
  name: string;
  impact: "positive" | "negative";
  description: string;
};

export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  gender: text("gender").notNull(), // 'Male', 'Female', 'Other'
  age: integer("age").notNull(),
  hypertension: boolean("hypertension").notNull(),
  heartDisease: boolean("heart_disease").notNull(),
  smokingHistory: text("smoking_history").notNull(), // 'never', 'current', 'former', etc.
  bmi: text("bmi").notNull(),
  hba1cLevel: text("hba1c_level").notNull(),
  bloodGlucoseLevel: text("blood_glucose_level").notNull(),
  
  // Model Outputs
  riskScore: text("risk_score").notNull(), // 0-100 percentage
  riskCategory: text("risk_category").notNull(), // 'LOW', 'MODERATE', 'HIGH'
  factors: jsonb("factors").$type<AssessmentFactor[]>().notNull(),
  confidenceInterval: jsonb("confidence_interval").$type<string | null>(),
  modelConfidence: text("model_confidence"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssessmentSchema = createInsertSchema(assessments, {
  gender: z.enum(["Male", "Female", "Other"], { required_error: "Please select a gender" }),
  age: z.coerce.number().min(1, "Age must be greater than 0").max(120, "Age is too high"),
  hypertension: z.boolean().default(false),
  heartDisease: z.boolean().default(false),
  smokingHistory: z.enum(["never", "No Info", "current", "former", "ever", "not current"], { required_error: "Please select smoking history" }),
  bmi: z.coerce.number().min(10, "BMI must be between 10 and 60").max(60, "BMI must be between 10 and 60"),
  hba1cLevel: z.coerce.number().min(3, "HbA1c must be between 3 and 15").max(15, "HbA1c must be between 3 and 15"),
  bloodGlucoseLevel: z.coerce.number().min(50, "Blood glucose must be between 50 and 400").max(400, "Blood glucose must be between 50 and 400"),
}).omit({
  id: true,
  riskScore: true,
  riskCategory: true,
  factors: true,
  confidenceInterval: true,
  modelConfidence: true,
  createdAt: true
});

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
