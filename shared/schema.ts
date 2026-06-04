import { pgTable, text, serial, integer, boolean, timestamp, jsonb, doublePrecision, uuid, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type AssessmentFactor = {
  name: string;
  impact: "positive" | "negative";
  description: string;
};

export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  gender: text("gender").notNull(), // 'Male', 'Female'
  age: integer("age").notNull(),
  hypertension: boolean("hypertension").notNull(),
  heartDisease: boolean("heart_disease").notNull(),
  smokingHistory: text("smoking_history").notNull(), // 'never', 'current', 'former', etc.
  bmi: doublePrecision("bmi").notNull(),
  hba1cLevel: doublePrecision("hba1c_level").notNull(),
  bloodGlucoseLevel: doublePrecision("blood_glucose_level").notNull(),

  // Model Outputs
  riskScore: doublePrecision("risk_score").notNull(), // 0-100 percentage
  riskCategory: text("risk_category").notNull(), // 'LOW', 'MODERATE', 'HIGH'
  factors: jsonb("factors").$type<AssessmentFactor[]>().notNull(),
  confidenceInterval: jsonb("confidence_interval").$type<string | null>(),
  modelConfidence: doublePrecision("model_confidence"),
  
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  userId: text("user_id"),
}, (table) => [
  index("created_by_id_idx").on(table.createdBy, table.id),
]);

export const insertAssessmentSchema = createInsertSchema(assessments, {
  // Restricted to Male/Female — the ML model was trained on binary gender data only.
  // Submitting "Other" would silently encode as Female; we reject it explicitly instead.
  patientName: z
    .string({ required_error: "Patient name is required", invalid_type_error: "Patient name must be a string" })
    .trim()
    .min(1, "Patient name is required"),
  gender: z.enum(["Male", "Female"], {
    required_error: "Gender is required",
    invalid_type_error: "Gender must be 'Male' or 'Female'",
  }),
  age: z.coerce
    .number({ invalid_type_error: "Age must be a number" })
    .int("Age must be a whole number")
    .min(1, "Age must be at least 1")
    .max(120, "Age must be 120 or below"),
  hypertension: z.boolean({ invalid_type_error: "Hypertension must be true or false" }).default(false),
  heartDisease: z.boolean({ invalid_type_error: "Heart disease must be true or false" }).default(false),
  smokingHistory: z.enum(["never", "No Info", "current", "former"], {
    required_error: "Smoking history is required",
    invalid_type_error: "Invalid smoking history value",
  }),
  bmi: z.coerce
    .number({ invalid_type_error: "BMI must be a number" })
    .min(10, "BMI must be at least 10")
    .max(60, "BMI must be 60 or below"),
  hba1cLevel: z.coerce
    .number({ invalid_type_error: "HbA1c level must be a number" })
    .min(3, "HbA1c must be at least 3")
    .max(15, "HbA1c must be 15 or below"),
  bloodGlucoseLevel: z.coerce
    .number({ invalid_type_error: "Blood glucose must be a number" })
    .min(50, "Blood glucose must be at least 50")
    .max(400, "Blood glucose must be 400 or below"),
  createdBy: z.string().email("createdBy must be a valid email").optional(),
}).omit({
  id: true,
  userId: true,
  riskScore: true,
  riskCategory: true,
  factors: true,
  confidenceInterval: true,
  modelConfidence: true,
  createdAt: true
});

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  medicalLicenseNumber: varchar("medical_license_number", { length: 100 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  role: varchar("role", { length: 50 }).default("provider"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userTermsAcceptance = pgTable("user_terms_acceptance", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  accepted: boolean("accepted").default(true).notNull(),
  termsVersion: varchar("terms_version", { length: 50 }),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
});

export const loginAuditLogs = pgTable("login_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  ipAddress: varchar("ip_address", { length: 100 }),
  userAgent: text("user_agent"),
  loginStatus: varchar("login_status", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  verificationCode: varchar("verification_code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  attemptCount: integer("attempt_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
