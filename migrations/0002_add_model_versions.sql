CREATE TABLE "model_versions" (
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
