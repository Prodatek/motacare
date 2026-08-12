DO $$ BEGIN
 CREATE TYPE "public"."note_type" AS ENUM('GENERAL', 'PREFERENCE', 'WARNING', 'FOLLOWUP');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fixer_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" "note_type" DEFAULT 'GENERAL' NOT NULL,
	"content" text NOT NULL,
	"vehicle_hash" varchar(64),
	"inspection_id" uuid,
	"fix_job_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_notes_fixer_owner_idx" ON "customer_notes" ("fixer_id","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_notes_fixer_idx" ON "customer_notes" ("fixer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customer_notes_owner_idx" ON "customer_notes" ("owner_id");