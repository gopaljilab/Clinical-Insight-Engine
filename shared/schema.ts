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
  
  ownerId: uuid("owner_id").references(() => users.id),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  userId: text("user_id"),
  clinicalNote: text("clinical_note"),
  explainableInsights: jsonb("explainable_insights").$type<Array<{
    insight: string;
    source_snippet: string | null;
    source_index: [number, number] | null;
  }>>(),
}, (table) => [
  index("created_by_id_idx").on(table.createdBy, table.id),
  index("owner_id_idx").on(table.ownerId),
]);

export const insertAssessmentSchema = createInsertSchema(assessments, {
  // Restricted to Male/Female — the ML model was trained on binary gender data only.
  // Submitting "Other" would silently encode as Female; we reject it explicitly instead.
  patientName: z
    .string({ invalid_type_error: "validation.patientName_string" })
    .trim()
    .min(1, "validation.patientName_empty")
    .optional(),
  gender: z.enum(["Male", "Female"], {
    required_error: "validation.gender_required",
    invalid_type_error: "validation.gender_invalid",
  }),
  age: z.preprocess(
    (v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      const sanitized = typeof v === "string" ? v.replace(/,/g, ".") : v;
      const n = Number(sanitized);
      return Number.isNaN(n) ? v : n;
    },
    z
      .number({ required_error: "validation.age_required", invalid_type_error: "validation.age_number" })
      .int("validation.age_int")
      .min(1, "validation.age_min")
      .max(120, "validation.age_max"),
  ),
  hypertension: z.boolean({ invalid_type_error: "validation.hypertension_boolean" }).default(false),
  heartDisease: z.boolean({ invalid_type_error: "validation.heartDisease_boolean" }).default(false),
  smokingHistory: z.enum(["never", "No Info", "current", "former"], {
    required_error: "validation.smokingHistory_required",
    invalid_type_error: "validation.smokingHistory_invalid",
  }),
  bmi: z.preprocess(
    (v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      const sanitized = typeof v === "string" ? v.replace(/,/g, ".") : v;
      const n = Number(sanitized);
      return Number.isNaN(n) ? v : n;
    },
    z
      .number({ required_error: "validation.bmi_required", invalid_type_error: "validation.bmi_number" })
      .min(10, "validation.bmi_min")
      .max(60, "validation.bmi_max"),
  ),
  hba1cLevel: z.preprocess(
    (v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      const sanitized = typeof v === "string" ? v.replace(/,/g, ".") : v;
      const n = Number(sanitized);
      return Number.isNaN(n) ? v : n;
    },
    z
      .number({ required_error: "validation.hba1c_required", invalid_type_error: "validation.hba1c_number" })
      .min(3, "validation.hba1c_min")
      .max(15, "validation.hba1c_max"),
  ),
  bloodGlucoseLevel: z.preprocess(
    (v) => {
      if (v === "" || v === undefined || v === null) return undefined;
      const sanitized = typeof v === "string" ? v.replace(/,/g, ".") : v;
      const n = Number(sanitized);
      return Number.isNaN(n) ? v : n;
    },
    z
      .number({ required_error: "validation.bloodGlucose_required", invalid_type_error: "validation.bloodGlucose_number" })
      .min(50, "validation.bloodGlucose_min")
      .max(400, "validation.bloodGlucose_max"),
  ),
  createdBy: z.string().email("validation.createdBy_email").optional(),
  clinicalNote: z.string().optional().nullable(),
  explainableInsights: z.array(z.object({
    insight: z.string(),
    source_snippet: z.string().nullable(),
    source_index: z.tuple([z.number(), z.number()]).nullable()
  })).optional().nullable(),
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

export const patientAccessAuditLogs = pgTable("patient_access_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
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

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
