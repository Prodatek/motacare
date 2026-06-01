import {
  pgTable, uuid, varchar, text, integer,
  boolean, timestamp, pgEnum, index, decimal, jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// ENUMS
// ============================================================

export const fixJobStatusEnum = pgEnum('fix_job_status', [
  'PENDING',
  'IN_PROGRESS',
  'AWAITING_PARTS',
  'COMPLETED',
  'DELIVERED',
  'CANCELLED',
]);

// ============================================================
// FIX JOBS TABLE
// ============================================================

export const fixJobs = pgTable(
  'fix_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Cross-service references (no FK — different DBs)
    inspectionId: uuid('inspection_id').notNull(),
    vehicleHash: varchar('vehicle_hash', { length: 64 }).notNull(),
    fixerId: uuid('fixer_id').notNull(),
    ownerId: uuid('owner_id').notNull(),

    // Core fields
    status: fixJobStatusEnum('status').notNull().default('PENDING'),
    description: text('description').notNull(),
    repairNotes: text('repair_notes'),
    cancelReason: text('cancel_reason'),           // set when status → CANCELLED

    // Timing
    estimatedCompletionAt: timestamp('estimated_completion_at'),
    actualCompletionAt:    timestamp('actual_completion_at'),

    // Cost
    estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }),
    finalCost:     decimal('final_cost', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('NGN'),

    // Parts — JSON array of { name, quantity, unitCost }
    partsUsed: jsonb('parts_used')
      .$type<Array<{ name: string; quantity: number; unitCost: number }>>()
      .default([]),

    // Alert tracking flags (Phase 2)
    alertSent24h:    boolean('alert_sent_24h').notNull().default(false),
    alertSent1h:     boolean('alert_sent_1h').notNull().default(false),
    alertSentOverdue: boolean('alert_sent_overdue').notNull().default(false),

    ownerNotifiedAt: timestamp('owner_notified_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    vehicleHashIdx:    index('fix_jobs_vehicle_hash_idx').on(table.vehicleHash),
    fixerIdx:          index('fix_jobs_fixer_idx').on(table.fixerId),
    ownerIdx:          index('fix_jobs_owner_idx').on(table.ownerId),
    statusIdx:         index('fix_jobs_status_idx').on(table.status),
    estimatedIdx:      index('fix_jobs_estimated_completion_idx').on(table.estimatedCompletionAt),
    inspectionIdx:     index('fix_jobs_inspection_idx').on(table.inspectionId),
  }),
);

// ============================================================
// STATUS HISTORY
// ============================================================

export const fixJobStatusHistory = pgTable(
  'fix_job_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fixJobId: uuid('fix_job_id')
      .notNull()
      .references(() => fixJobs.id, { onDelete: 'cascade' }),
    fromStatus: fixJobStatusEnum('from_status'),
    toStatus:   fixJobStatusEnum('to_status').notNull(),
    changedBy:  uuid('changed_by').notNull(),
    notes:      text('notes'),
    changedAt:  timestamp('changed_at').notNull().defaultNow(),
  },
  (table) => ({
    fixJobIdx: index('status_history_fix_job_idx').on(table.fixJobId),
  }),
);

// ============================================================
// RELATIONS
// ============================================================

export const fixJobsRelations = relations(fixJobs, ({ many }) => ({
  statusHistory: many(fixJobStatusHistory),
}));

export const statusHistoryRelations = relations(fixJobStatusHistory, ({ one }) => ({
  fixJob: one(fixJobs, {
    fields: [fixJobStatusHistory.fixJobId],
    references: [fixJobs.id],
  }),
}));

// ============================================================
// INFERRED TYPES
// ============================================================

export type FixJob = typeof fixJobs.$inferSelect;
export type NewFixJob = typeof fixJobs.$inferInsert;
export type FixJobStatusHistory = typeof fixJobStatusHistory.$inferSelect;
export type FixJobStatus = 'PENDING' | 'IN_PROGRESS' | 'AWAITING_PARTS' | 'COMPLETED' | 'DELIVERED' | 'CANCELLED';
export type PartEntry = { name: string; quantity: number; unitCost: number };