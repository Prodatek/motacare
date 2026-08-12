CREATE TYPE "public"."check_status" AS ENUM('PASS', 'FAIL', 'WARNING', 'NOT_CHECKED');--> statement-breakpoint
CREATE TYPE "public"."fix_job_status" AS ENUM('PENDING', 'IN_PROGRESS', 'AWAITING_PARTS', 'COMPLETED', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'NEEDS_FOLLOWUP');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TABLE "fix_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"vehicle_hash" varchar(64) NOT NULL,
	"fixer_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" "fix_job_status" DEFAULT 'PENDING' NOT NULL,
	"description" text NOT NULL,
	"estimated_completion_at" timestamp,
	"actual_completion_at" timestamp,
	"estimated_cost" numeric(10, 2),
	"final_cost" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"repair_notes" text,
	"parts_used" jsonb DEFAULT '[]'::jsonb,
	"alert_sent_at_24h" boolean DEFAULT false NOT NULL,
	"alert_sent_at_1h" boolean DEFAULT false NOT NULL,
	"overdue_alert_sent_at" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"check_id" varchar(100) NOT NULL,
	"check_name" varchar(200) NOT NULL,
	"status" "check_status" DEFAULT 'NOT_CHECKED' NOT NULL,
	"severity" "severity",
	"notes" text,
	"media_urls" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_hash" varchar(64) NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"fixer_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" "inspection_status" DEFAULT 'DRAFT' NOT NULL,
	"mileage_at_inspection" integer NOT NULL,
	"summary" text,
	"ai_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "fix_jobs" ADD CONSTRAINT "fix_jobs_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fix_jobs_vehicle_hash_idx" ON "fix_jobs" USING btree ("vehicle_hash");--> statement-breakpoint
CREATE INDEX "fix_jobs_fixer_idx" ON "fix_jobs" USING btree ("fixer_id");--> statement-breakpoint
CREATE INDEX "fix_jobs_owner_idx" ON "fix_jobs" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "fix_jobs_status_idx" ON "fix_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fix_jobs_estimated_completion_idx" ON "fix_jobs" USING btree ("estimated_completion_at");--> statement-breakpoint
CREATE INDEX "inspection_items_inspection_idx" ON "inspection_items" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "inspection_items_category_idx" ON "inspection_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "inspection_items_status_idx" ON "inspection_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inspections_vehicle_hash_idx" ON "inspections" USING btree ("vehicle_hash");--> statement-breakpoint
CREATE INDEX "inspections_fixer_idx" ON "inspections" USING btree ("fixer_id");--> statement-breakpoint
CREATE INDEX "inspections_owner_idx" ON "inspections" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "inspections_status_idx" ON "inspections" USING btree ("status");