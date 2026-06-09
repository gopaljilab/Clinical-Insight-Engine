CREATE TABLE IF NOT EXISTS "patient_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "patient_name" text NOT NULL UNIQUE,
  "email" varchar(255) NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "phone" varchar(20),
  "is_active" boolean DEFAULT true,
  "email_verified" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
