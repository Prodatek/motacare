import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  pgEnum,
  jsonb,
  index,
  decimal,
} from 'drizzle-orm/pg-core';

// ============================================================
// ENUMS
// ============================================================

export const inspectionStatusEnum = pgEnum('inspection_status', [
  'DRAFT',         // Started but not submitted
  'IN_PROGRESS',   // Fixer actively working through checklist
  'COMPLETED',     // All items checked, inspection finalised
  'NEEDS_FOLLOWUP', // Issues found that need a return visit
]);

export const fixJobStatusEnum = pgEnum('fix_job_status', [
  'PENDING',         // Logged, not yet started
  'IN_PROGRESS',     // Fixer is actively working
  'AWAITING_PARTS',  // Blocked on parts delivery
  'COMPLETED',       // Work done, not yet collected
  'DELIVERED',       // Vehicle returned to owner
  'CANCELLED',       // Job cancelled
]);

export const checkStatusEnum = pgEnum('check_status', [
  'PASS',
  'FAIL',
  'WARNING',
  'NOT_CHECKED',
]);

export const severityEnum = pgEnum('severity', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

// ============================================================
// INSPECTIONS TABLE
// One inspection session per visit. A vehicle can have many
// inspections over its lifetime — this is the full history.
// ============================================================

export const inspections = pgTable(
  'inspections',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Vehicle reference — uses hash (not FK) since vehicle lives
    // in a separate DB. Hash is the stable cross-service identifier.
    vehicleHash: varchar('vehicle_hash', { length: 64 }).notNull(),
    vehicleId: uuid('vehicle_id').notNull(), // Cached for reporting

    // People involved
    fixerId: uuid('fixer_id').notNull(),
    ownerId: uuid('owner_id').notNull(),

    // State
    status: inspectionStatusEnum('status').notNull().default('DRAFT'),

    // Odometer at the time of inspection
    // Critical for tracking wear over time and OBD analysis (Phase 3)
    mileageAtInspection: integer('mileage_at_inspection').notNull(),

    // Fixer's overall written summary
    summary: text('summary'),

    // AI-generated summary (populated in Phase 2)
    aiSummary: text('ai_summary'),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    vehicleHashIdx: index('inspections_vehicle_hash_idx').on(table.vehicleHash),
    fixerIdx: index('inspections_fixer_idx').on(table.fixerId),
    ownerIdx: index('inspections_owner_idx').on(table.ownerId),
    statusIdx: index('inspections_status_idx').on(table.status),
  }),
);

// ============================================================
// INSPECTION ITEMS TABLE
// One row per checklist item per inspection.
// Storing as rows (not JSON) enables querying by category,
// aggregating pass/fail rates, and spotting trends across cars.
// ============================================================

export const inspectionItems = pgTable(
  'inspection_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    inspectionId: uuid('inspection_id')
      .notNull()
      .references(() => inspections.id, { onDelete: 'cascade' }),

    // Checklist structure
    category: varchar('category', { length: 100 }).notNull(), // e.g. "Engine"
    checkId: varchar('check_id', { length: 100 }).notNull(),  // e.g. "engine_oil_level"
    checkName: varchar('check_name', { length: 200 }).notNull(), // Human label

    // Result
    status: checkStatusEnum('status').notNull().default('NOT_CHECKED'),
    severity: severityEnum('severity'),

    // Fixer notes for this specific item
    notes: text('notes'),

    // Photo/video URLs uploaded by fixer (stored as JSON array)
    mediaUrls: jsonb('media_urls').$type<string[]>().default([]),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    inspectionIdx: index('inspection_items_inspection_idx').on(table.inspectionId),
    categoryIdx: index('inspection_items_category_idx').on(table.category),
    statusIdx: index('inspection_items_status_idx').on(table.status),
  }),
);

// ============================================================
// FIX JOBS TABLE
// Created when an inspection reveals issues needing repair.
// Tracks the full lifecycle from job creation to delivery.
// ============================================================

export const fixJobs = pgTable(
  'fix_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Linked to the inspection that generated this job
    inspectionId: uuid('inspection_id')
      .notNull()
      .references(() => inspections.id),

    // Denormalised for fast querying without joins
    vehicleHash: varchar('vehicle_hash', { length: 64 }).notNull(),
    fixerId: uuid('fixer_id').notNull(),
    ownerId: uuid('owner_id').notNull(),

    // Job details
    status: fixJobStatusEnum('status').notNull().default('PENDING'),
    description: text('description').notNull(),

    // Timing — used by alert system
    estimatedCompletionAt: timestamp('estimated_completion_at'),
    actualCompletionAt: timestamp('actual_completion_at'),

    // Cost tracking
    estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }),
    finalCost: decimal('final_cost', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('NGN'),

    // Fixer notes on the repair itself
    repairNotes: text('repair_notes'),

    // Parts used (JSON array of { name, quantity, cost })
    partsUsed: jsonb('parts_used').$type<Array<{
      name: string;
      quantity: number;
      unitCost: number;
    }>>().default([]),

    // Alert flags — set to true once alert has fired
    alertSentAt24h: boolean('alert_sent_at_24h').notNull().default(false),
    alertSentAt1h: boolean('alert_sent_at_1h').notNull().default(false),
    overdueAlertSentAt: boolean('overdue_alert_sent_at').notNull().default(false),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    vehicleHashIdx: index('fix_jobs_vehicle_hash_idx').on(table.vehicleHash),
    fixerIdx: index('fix_jobs_fixer_idx').on(table.fixerId),
    ownerIdx: index('fix_jobs_owner_idx').on(table.ownerId),
    statusIdx: index('fix_jobs_status_idx').on(table.status),
    estimatedCompletionIdx: index('fix_jobs_estimated_completion_idx').on(
      table.estimatedCompletionAt,
    ),
  }),
);

// ============================================================
// INFERRED TYPES
// ============================================================

export type Inspection = typeof inspections.$inferSelect;
export type NewInspection = typeof inspections.$inferInsert;
export type InspectionItem = typeof inspectionItems.$inferSelect;
export type NewInspectionItem = typeof inspectionItems.$inferInsert;
export type FixJob = typeof fixJobs.$inferSelect;
export type NewFixJob = typeof fixJobs.$inferInsert;