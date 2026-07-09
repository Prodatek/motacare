import {
  pgTable, uuid, text, timestamp, varchar, pgEnum, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// CRM SERVICE SCHEMA
//
// The CRM doesn't duplicate inspection/fix-job data.
// It only owns the NOTES a fixer writes about a customer —
// everything else is fetched live from the source services.
// ============================================================

export const noteTypeEnum = pgEnum('note_type', [
  'GENERAL',
  'PREFERENCE',   // e.g. "Owner prefers OEM parts only"
  'WARNING',      // e.g. "Check payment status before starting work"
  'FOLLOWUP',     // e.g. "Call back in 2 weeks to check on brakes"
]);

// ── CUSTOMER NOTES ────────────────────────────────────────────
// Keyed by (fixerId, ownerId) — one set of notes per fixer-customer pair.
// A fixer's notes about an owner are private to that fixer.

export const customerNotes = pgTable(
  'customer_notes',
  {
    id:       uuid('id').primaryKey().defaultRandom(),
    fixerId:  uuid('fixer_id').notNull(),   // who wrote the note (cross-service)
    ownerId:  uuid('owner_id').notNull(),   // who the note is about (cross-service)

    type:     noteTypeEnum('type').notNull().default('GENERAL'),
    content:  text('content').notNull(),

    // Optional: pin a note to a specific vehicle or visit
    vehicleHash:  varchar('vehicle_hash', { length: 64 }),
    inspectionId: uuid('inspection_id'),
    fixJobId:     uuid('fix_job_id'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    fixerOwnerIdx: index('customer_notes_fixer_owner_idx').on(table.fixerId, table.ownerId),
    fixerIdx:      index('customer_notes_fixer_idx').on(table.fixerId),
    ownerIdx:      index('customer_notes_owner_idx').on(table.ownerId),
  }),
);

export type CustomerNote    = typeof customerNotes.$inferSelect;
export type NewCustomerNote = typeof customerNotes.$inferInsert;
export type NoteType        = 'GENERAL' | 'PREFERENCE' | 'WARNING' | 'FOLLOWUP';