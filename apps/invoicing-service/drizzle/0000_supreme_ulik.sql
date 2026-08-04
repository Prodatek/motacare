DO $$ BEGIN
 CREATE TYPE "public"."catalog_item_kind" AS ENUM('PART', 'LABOR', 'MISC');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."doc_type" AS ENUM('QUOTE', 'INVOICE');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CARD', 'CHEQUE', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."quote_status" AS ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"description" varchar(300) NOT NULL,
	"normalized_description" varchar(300) NOT NULL,
	"kind" "catalog_item_kind" DEFAULT 'MISC' NOT NULL,
	"category" varchar(100),
	"default_unit" varchar(20) DEFAULT 'pcs' NOT NULL,
	"default_unit_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_items_workshop_norm_desc_unique" UNIQUE("workshop_id","normalized_description")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_counters_workshop_doc_type_unique" UNIQUE("workshop_id","doc_type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"catalog_item_id" uuid,
	"description" varchar(300) NOT NULL,
	"kind" "catalog_item_kind",
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit" varchar(20) DEFAULT 'pcs' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"invoice_number" varchar(30) NOT NULL,
	"status" "invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"source_quote_id" uuid,
	"customer_name" varchar(200) NOT NULL,
	"customer_contact" varchar(200) NOT NULL,
	"customer_address" text,
	"owner_id" uuid,
	"vehicle_hash" varchar(64),
	"vehicle_description" varchar(300),
	"inspection_id" uuid,
	"fix_job_id" uuid,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_due" numeric(12, 2) DEFAULT '0' NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"due_date" timestamp,
	"sent_at" timestamp,
	"paid_at" timestamp,
	"voided_at" timestamp,
	"void_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_workshop_number_unique" UNIQUE("workshop_id","invoice_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"workshop_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_at" timestamp NOT NULL,
	"reference" varchar(100),
	"note" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"catalog_item_id" uuid,
	"description" varchar(300) NOT NULL,
	"kind" "catalog_item_kind",
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit" varchar(20) DEFAULT 'pcs' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workshop_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"quote_number" varchar(30) NOT NULL,
	"status" "quote_status" DEFAULT 'DRAFT' NOT NULL,
	"customer_name" varchar(200) NOT NULL,
	"customer_contact" varchar(200) NOT NULL,
	"customer_address" text,
	"owner_id" uuid,
	"vehicle_hash" varchar(64),
	"vehicle_description" varchar(300),
	"inspection_id" uuid,
	"fix_job_id" uuid,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"valid_until" timestamp,
	"sent_at" timestamp,
	"responded_at" timestamp,
	"rejection_reason" text,
	"converted_invoice_id" uuid,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_workshop_number_unique" UNIQUE("workshop_id","quote_number")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_source_quote_id_quotes_id_fk" FOREIGN KEY ("source_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_items_workshop_idx" ON "catalog_items" ("workshop_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_items_workshop_usage_idx" ON "catalog_items" ("workshop_id","usage_count");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "catalog_items_workshop_recent_idx" ON "catalog_items" ("workshop_id","last_used_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_line_items_invoice_idx" ON "invoice_line_items" ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_workshop_idx" ON "invoices" ("workshop_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_workshop_status_idx" ON "invoices" ("workshop_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_owner_idx" ON "invoices" ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_due_date_idx" ON "invoices" ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_invoice_idx" ON "payments" ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_workshop_idx" ON "payments" ("workshop_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_workshop_paid_at_idx" ON "payments" ("workshop_id","paid_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_line_items_quote_idx" ON "quote_line_items" ("quote_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_workshop_idx" ON "quotes" ("workshop_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_workshop_status_idx" ON "quotes" ("workshop_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quotes_owner_idx" ON "quotes" ("owner_id");