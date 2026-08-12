CREATE TYPE "public"."membership_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'LEFT');--> statement-breakpoint
CREATE TYPE "public"."workshop_status" AS ENUM('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TABLE "workshop_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"fixer_id" uuid NOT NULL,
	"status" "membership_status" DEFAULT 'PENDING' NOT NULL,
	"join_request_note" text,
	"rejection_reason" text,
	"approved_by" uuid,
	"joined_at" timestamp,
	"left_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"description" text,
	"address" text NOT NULL,
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"phone" varchar(20),
	"email" varchar(255),
	"logo_url" varchar(500),
	"cover_image_url" varchar(500),
	"specialties" jsonb DEFAULT '[]'::jsonb,
	"status" "workshop_status" DEFAULT 'PENDING_APPROVAL' NOT NULL,
	"admin_id" uuid NOT NULL,
	"max_fixers" integer DEFAULT 5 NOT NULL,
	"current_fixer_count" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"total_inspections" integer DEFAULT 0 NOT NULL,
	"total_fix_jobs" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workshops_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "workshop_members" ADD CONSTRAINT "workshop_members_workshop_id_workshops_id_fk" FOREIGN KEY ("workshop_id") REFERENCES "public"."workshops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workshop_members_workshop_idx" ON "workshop_members" USING btree ("workshop_id");--> statement-breakpoint
CREATE INDEX "workshop_members_fixer_idx" ON "workshop_members" USING btree ("fixer_id");--> statement-breakpoint
CREATE INDEX "workshop_members_status_idx" ON "workshop_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workshops_slug_idx" ON "workshops" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "workshops_admin_idx" ON "workshops" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "workshops_status_idx" ON "workshops" USING btree ("status");--> statement-breakpoint
CREATE INDEX "workshops_featured_idx" ON "workshops" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "workshops_city_idx" ON "workshops" USING btree ("city");