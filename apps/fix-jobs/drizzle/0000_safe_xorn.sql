CREATE TYPE "public"."fix_job_status" AS ENUM('PENDING', 'IN_PROGRESS', 'AWAITING_PARTS', 'COMPLETED', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "fix_job_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fix_job_id" uuid NOT NULL,
	"from_status" "fix_job_status",
	"to_status" "fix_job_status" NOT NULL,
	"changed_by" uuid NOT NULL,
	"notes" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fix_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"vehicle_hash" varchar(64) NOT NULL,
	"fixer_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" "fix_job_status" DEFAULT 'PENDING' NOT NULL,
	"description" text NOT NULL,
	"repair_notes" text,
	"cancel_reason" text,
	"estimated_completion_at" timestamp,
	"actual_completion_at" timestamp,
	"estimated_cost" numeric(10, 2),
	"final_cost" numeric(10, 2),
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"parts_used" jsonb DEFAULT '[]'::jsonb,
	"alert_sent_24h" boolean DEFAULT false NOT NULL,
	"alert_sent_1h" boolean DEFAULT false NOT NULL,
	"alert_sent_overdue" boolean DEFAULT false NOT NULL,
	"owner_notified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fix_job_status_history" ADD CONSTRAINT "fix_job_status_history_fix_job_id_fix_jobs_id_fk" FOREIGN KEY ("fix_job_id") REFERENCES "public"."fix_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "status_history_fix_job_idx" ON "fix_job_status_history" USING btree ("fix_job_id");--> statement-breakpoint
CREATE INDEX "fix_jobs_vehicle_hash_idx" ON "fix_jobs" USING btree ("vehicle_hash");--> statement-breakpoint
CREATE INDEX "fix_jobs_fixer_idx" ON "fix_jobs" USING btree ("fixer_id");--> statement-breakpoint
CREATE INDEX "fix_jobs_owner_idx" ON "fix_jobs" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "fix_jobs_status_idx" ON "fix_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fix_jobs_estimated_completion_idx" ON "fix_jobs" USING btree ("estimated_completion_at");--> statement-breakpoint
CREATE INDEX "fix_jobs_inspection_idx" ON "fix_jobs" USING btree ("inspection_id");