CREATE TABLE "dead_letter_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_job_id" text,
	"payload" jsonb NOT NULL,
	"error_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
