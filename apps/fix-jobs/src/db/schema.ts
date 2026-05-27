import {
  pgTable, uuid, varchar, text, integer,
  boolean, timestamp, pgEnum, index, decimal,
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
// Owns the full lifecycle of a repair job from creation
// through to vehicle delivery back to the owner.
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

    // Job details
    status: fixJobStatusEnum('status').notNull().default('PENDING'),
    description: text('description').notNull(),

    // Timing — drives the alert system (Phase 2 Stage 2)
    estimatedCompletionAt: timestamp('estimated_completion_at'),
    actualCompletionAt: timestamp('actual_completion_at'),

    // Cost tracking
    estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }),
    finalCost: decimal('final_cost', { precision: 10, scale: 2 }),
    currency: varchar('currency', { length: 3 }).notNull().default('NGN'),

    // Fixer notes on the repair work
    repairNotes: text('repair_notes'),

    // Alert tracking flags — set true once each alert fires
    // Prevents duplicate alerts on queue retry
    alertSent24h: boolean('alert_sent_24h').notNull().default(false),
    alertSent1h: boolean('alert_sent_1h').notNull().default(false),
    alertSentOverdue: boolean('alert_sent_overdue').notNull().default(false),

    // Owner acknowledgement
    ownerNotifiedAt: timestamp('owner_notified_at'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    vehicleHashIdx: index('fix_jobs_vehicle_hash_idx').on(table.vehicleHash),
    fixerIdx: index('fix_jobs_fixer_idx').on(table.fixerId),
    ownerIdx: index('fix_jobs_owner_idx').on(table.ownerId),
    statusIdx: index('fix_jobs_status_idx').on(table.status),
    estimatedIdx: index('fix_jobs_estimated_completion_idx').on(table.estimatedCompletionAt),
    inspectionIdx: index('fix_jobs_inspection_idx').on(table.inspectionId),
  }),
);

// ============================================================
// STATUS HISTORY TABLE
// Immutable log of every status change on a job.
// Gives owners full transparency and supports dispute resolution.
// ============================================================

export const fixJobStatusHistory = pgTable(
  'fix_job_status_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fixJobId: uuid('fix_job_id')
      .notNull()
      .references(() => fixJobs.id, { onDelete: 'cascade' }),
    fromStatus: fixJobStatusEnum('from_status'),
    toStatus: fixJobStatusEnum('to_status').notNull(),
    changedBy: uuid('changed_by').notNull(), // user ID
    notes: text('notes'),
    changedAt: timestamp('changed_at').notNull().defaultNow(),
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