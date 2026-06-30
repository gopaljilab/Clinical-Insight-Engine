-- Add remaining schema tables and columns idempotently
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "verification_code" varchar(6) NOT NULL,
    "expires_at" timestamp NOT NULL,
    "used" boolean DEFAULT false,
    "attempt_count" integer DEFAULT 0,
    "created_at" timestamp DEFAULT now() NOT NULL
  );
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS "model_versions" (
    "id" serial PRIMARY KEY NOT NULL,
    "version" integer NOT NULL,
    "accuracy" double precision,
    "precision" double precision,
    "recall" double precision,
    "f1_score" double precision,
    "auc_roc" double precision,
    "dataset_hash" text,
    "num_samples" integer,
    "num_features" integer,
    "class_balance" jsonb,
    "feature_distributions" jsonb,
    "training_duration_ms" integer,
    "status" text DEFAULT 'completed',
    "error_message" text,
    "created_at" timestamp DEFAULT now() NOT NULL
  );
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS "patient_access_audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "resource_type" text NOT NULL,
    "resource_id" text,
    "action" text NOT NULL,
    "ip_address" text,
    "user_agent" text,
    "granted" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  );
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TABLE IF NOT EXISTS "patient_users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "patient_name" text NOT NULL,
    "email" varchar(255) NOT NULL,
    "password_hash" text NOT NULL,
    "phone" varchar(20),
    "is_active" boolean DEFAULT true,
    "email_verified" boolean DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "patient_users_patient_name_unique" UNIQUE("patient_name"),
    CONSTRAINT "patient_users_email_unique" UNIQUE("email")
  );
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "assessments" ADD COLUMN "owner_id" uuid;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "assessments" ADD COLUMN "clinical_note" text;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "assessments" ADD COLUMN "explainable_insights" jsonb;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "patient_access_audit_logs" ADD CONSTRAINT "patient_access_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "assessments" ADD CONSTRAINT "assessments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "created_by_id_idx" ON "assessments" USING btree ("created_by","id");
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "owner_id_idx" ON "assessments" USING btree ("owner_id");
END $$;
