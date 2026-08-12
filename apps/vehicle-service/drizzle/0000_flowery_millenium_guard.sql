CREATE TYPE "public"."fuel_type" AS ENUM('PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG', 'LPG');--> statement-breakpoint
CREATE TYPE "public"."transmission_type" AS ENUM('MANUAL', 'AUTOMATIC', 'CVT');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('ACTIVE', 'INACTIVE', 'TRANSFERRED');--> statement-breakpoint
CREATE TABLE "vehicle_ownership_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"previous_owner_id" uuid NOT NULL,
	"new_owner_id" uuid NOT NULL,
	"previous_hash" varchar(64) NOT NULL,
	"new_hash" varchar(64) NOT NULL,
	"mileage_at_transfer" integer NOT NULL,
	"transferred_at" timestamp DEFAULT now() NOT NULL,
	"notes" varchar(500)
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hash" varchar(64) NOT NULL,
	"owner_id" uuid NOT NULL,
	"vin" varchar(17) NOT NULL,
	"license_plate" varchar(20) NOT NULL,
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"year" integer NOT NULL,
	"color" varchar(50),
	"trim" varchar(100),
	"fuel_type" "fuel_type" NOT NULL,
	"transmission_type" "transmission_type" NOT NULL,
	"engine_capacity" varchar(20),
	"engine_code" varchar(50),
	"mileage_at_registration" integer DEFAULT 0 NOT NULL,
	"status" "vehicle_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_hash_unique" UNIQUE("hash"),
	CONSTRAINT "vehicles_vin_owner_unique" UNIQUE("vin","owner_id")
);
--> statement-breakpoint
ALTER TABLE "vehicle_ownership_history" ADD CONSTRAINT "vehicle_ownership_history_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ownership_history_vehicle_idx" ON "vehicle_ownership_history" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicles_owner_idx" ON "vehicles" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "vehicles_hash_idx" ON "vehicles" USING btree ("hash");--> statement-breakpoint
CREATE INDEX "vehicles_license_plate_idx" ON "vehicles" USING btree ("license_plate");