CREATE TABLE "assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"gender" text NOT NULL,
	"age" integer NOT NULL,
	"hypertension" boolean NOT NULL,
	"heart_disease" boolean NOT NULL,
	"smoking_history" text NOT NULL,
	"bmi" double precision NOT NULL,
	"hba1c_level" double precision NOT NULL,
	"blood_glucose_level" double precision NOT NULL,
	"risk_score" double precision NOT NULL,
	"risk_category" text NOT NULL,
	"factors" jsonb NOT NULL,
	"confidence_interval" jsonb,
	"model_confidence" double precision,
	"created_at" timestamp DEFAULT now(),
	"created_by" text,
	"user_id" text
);
--> statement-breakpoint
CREATE TABLE "login_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"ip_address" varchar(100),
	"user_agent" text,
	"login_status" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_terms_acceptance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"accepted" boolean DEFAULT true NOT NULL,
	"terms_version" varchar(50),
	"accepted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"medical_license_number" varchar(100) NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"email_verified" boolean DEFAULT false,
	"role" varchar(50) DEFAULT 'provider',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_medical_license_number_unique" UNIQUE("medical_license_number")
);
--> statement-breakpoint
ALTER TABLE "login_audit_logs" ADD CONSTRAINT "login_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_terms_acceptance" ADD CONSTRAINT "user_terms_acceptance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;