import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // 💡 Explicitly declare your managed table names rather than using standard wildcards
  tablesFilter: [
    "assessments",
    "users",
    "user_terms_acceptance",
    "login_audit_logs",
    "password_reset_tokens",
    "email_verification_tokens",
    "model_versions"
  ],
});