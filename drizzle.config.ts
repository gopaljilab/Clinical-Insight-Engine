import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const dbUrl = process.env.DATABASE_URL;
const useSSL =
  process.env.DB_SSL === "true" ||
  /supabase\.co|pooler\.supabase\.com/i.test(dbUrl);

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
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