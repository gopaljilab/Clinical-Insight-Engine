import { pgTable, text, serial, integer, boolean, timestamp, jsonb, doublePrecision, uuid, varchar, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export type AssessmentFactor = {
  name: string;
  impact: "positive" | "negative";
  description: string;
};

export const assessments = pgTable(
  "assessments",
  {
    id: serial("id").primaryKey(),
    patientName: text("patient_name").notNull(),
    gender: text("gender").notNull(),
    age: integer("age").notNull(),
    hypertension: boolean("hypertension").notNull(),
    heartDisease: boolean("heart_disease").notNull(),
    smokingHistory: text("smoking_history").notNull(),
    bmi: doublePrecision("bmi").notNull(),
    hba1cLevel: doublePrecision("hba1c_level").notNull(),
    bloodGlucoseLevel: doublePrecision("blood_glucose_level").notNull(),
    insulin: doublePrecision("insulin"),
    skinThickness: doublePrecision("skin_thickness"),

    // Model Outputs
    riskScore: doublePrecision("risk_score").notNull(),
    riskCategory: text("risk_category").notNull(),
    factors: jsonb("factors").$type<AssessmentFactor[]>().notNull(),
    confidenceInterval: jsonb("confidence_interval").$type<string | null>(),
    modelConfidence: doublePrecision("model_confidence"),

    ownerId: uuid("owner_id").references(() => users.id),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow(),
    userId: text("user_id"),
    clinicalNote: text("clinical_note"),
    explainableInsights: jsonb("explainable_insights").$type<
      Array<{
        insight: string;
        source_snippet: string | null;
        source_index: [number, number] | null;
      }>
    >(),
  },
  (table) => [
    index("created_by_id_idx").on(table.createdBy, table.id),
    index("owner_id_idx").on(table.ownerId),
  ]
);

// Explicit insert schema for request-side fields.
// Using drizzle-zod omit() triggers TS typing issues in this repo's current
// drizzle/drizzle-zod versions.
export const insertAssessmentSchema = z.object({
  patientName: z.string().trim().min(1),
  gender: z.enum(["Male", "Female"]),
  age: z.number().int().min(1).max(120),
  hypertension: z.boolean().default(false),
  heartDisease: z.boolean().default(false),
  smokingHistory: z.enum(["never", "No Info", "current", "former"]),
  bmi: z.number().min(10).max(60),
  hba1cLevel: z.number().min(3).max(15),
  bloodGlucoseLevel: z.number().min(50).max(400),
  createdBy: z.string().email().optional(),
  clinicalNote: z.string().optional().nullable(),
  explainableInsights: z
    .array(
      z.object({
        insight: z.string(),
        source_snippet: z.string().nullable(),
        source_index: z.tuple([z.number(), z.number()]).nullable(),
      })
    )
    .optional()
    .nullable(),
});

export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;

export const assessmentNotes = pgTable("assessment_notes", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  section: text("section").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAssessmentNoteSchema = z.object({
  assessmentId: z.number().int(),
  userId: z.string(),
  section: z.string(),
  content: z.string(),
});

export type AssessmentNote = typeof assessmentNotes.$inferSelect;
export type InsertAssessmentNote = z.infer<typeof insertAssessmentNoteSchema>;

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
  reportFrequency: varchar("report_frequency", { length: 20 }).default("none"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userTermsAcceptance = pgTable("user_terms_acceptance", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
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

export const patientAccessAuditLogs = pgTable("patient_access_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  action: text("action").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  granted: boolean("granted").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
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

export const modelVersions = pgTable("model_versions", {
  id: serial("id").primaryKey(),
  version: integer("version").notNull(),
  accuracy: doublePrecision("accuracy"),
  precision: doublePrecision("precision"),
  recall: doublePrecision("recall"),
  f1Score: doublePrecision("f1_score"),
  aucRoc: doublePrecision("auc_roc"),
  datasetHash: text("dataset_hash"),
  numSamples: integer("num_samples"),
  numFeatures: integer("num_features"),
  classBalance: jsonb("class_balance"),
  featureDistributions: jsonb("feature_distributions"),
  trainingDurationMs: integer("training_duration_ms"),
  status: text("status").default("completed"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const patientUsers = pgTable("patient_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientName: text("patient_name").notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  phone: varchar("phone", { length: 20 }),
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PatientUser = typeof patientUsers.$inferSelect;
export type InsertPatientUser = typeof patientUsers.$inferInsert;

export type ModelVersion = typeof modelVersions.$inferSelect;
export type InsertModelVersion = typeof modelVersions.$inferInsert;

export const insertUserSchema = z.object({
  fullName: z.string(),
  email: z.string().email(),
  medicalLicenseNumber: z.string(),
  passwordHash: z.string(),
  isActive: z.boolean().default(true),
  emailVerified: z.boolean().default(false),
  emailVerifiedAt: z.date().optional(),
  role: z.string().optional(),
  reportFrequency: z.string().optional(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
