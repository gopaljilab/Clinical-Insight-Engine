CREATE TABLE "assessment_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"section" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "insulin" double precision;--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "skin_thickness" double precision;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "report_frequency" varchar(20) DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "assessment_notes" ADD CONSTRAINT "assessment_notes_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_notes" ADD CONSTRAINT "assessment_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;