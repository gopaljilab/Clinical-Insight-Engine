import { pgTable, text, serial, integer, boolean, numeric, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  gender: text("gender").notNull(), // 'Male', 'Female', 'Other'
  age: integer("age").notNull(),
  hypertension: boolean("hypertension").notNull(),
  heartDisease: boolean("heart_disease").notNull(),
  smokingHistory: text("smoking_history").notNull(), // 'never', 'current', 'former', etc.
  bmi: numeric("bmi").notNull(),
  hba1cLevel: numeric("hba1c_level").notNull(),
  bloodGlucoseLevel: numeric("blood_glucose_level").notNull(),
  
  // Model Outputs
  riskScore: numeric("risk_score").notNull(), // 0-100 percentage
  riskCategory: text("risk_category").notNull(), // 'LOW', 'MODERATE', 'HIGH'
  factors: json("factors").notNull(), // Array of { name, impact: 'positive' | 'negative', description }
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssessmentSchema = createInsertSchema(assessments, {
  age: z.coerce.number().min(0).max(120),
  bmi: z.coerce.number().min(10).max(100),
  hba1cLevel: z.coerce.number().min(3).max(20),
  bloodGlucoseLevel: z.coerce.number().min(50).max(500),
  hypertension: z.boolean(),
  heartDisease: z.boolean(),
}).omit({
  id: true,
  riskScore: true,
  riskCategory: true,
  factors: true,
  createdAt: true
});

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
