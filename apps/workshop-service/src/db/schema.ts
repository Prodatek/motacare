import {
  pgTable, uuid, varchar, text, boolean,
  timestamp, pgEnum, index, integer, decimal, jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// ENUMS
// ============================================================

export const workshopStatusEnum = pgEnum('workshop_status', [
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
]);

export const membershipStatusEnum = pgEnum('membership_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'LEFT',
]);

// ============================================================
// WORKSHOPS TABLE
// ============================================================

export const workshops = pgTable(
  'workshops',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Identity
    name:        varchar('name', { length: 200 }).notNull(),
    slug:        varchar('slug', { length: 220 }).notNull().unique(),
    description: text('description'),
    address:     text('address').notNull(),
    city:        varchar('city', { length: 100 }).notNull(),
    state:       varchar('state', { length: 100 }).notNull(),
    phone:       varchar('phone', { length: 20 }),
    email:       varchar('email', { length: 255 }),

    // Branding
    logoUrl:       varchar('logo_url', { length: 500 }),
    coverImageUrl: varchar('cover_image_url', { length: 500 }),

    // Specialties — stored as a JSON array of strings
    // e.g. ["Engine", "Electrical", "Tyres", "AC", "Brakes"]
    specialties: jsonb('specialties').$type<string[]>().default([]),

    // Lifecycle
    status:  workshopStatusEnum('status').notNull().default('PENDING_APPROVAL'),
    adminId: uuid('admin_id').notNull(),  // WORKSHOP_ADMIN user — cross-service ref

    // Capacity
    maxFixers:          integer('max_fixers').notNull().default(5),
    currentFixerCount:  integer('current_fixer_count').notNull().default(0),

    // Discovery
    featured: boolean('featured').notNull().default(false),

    // Denormalised lifetime totals (updated on each inspection/fix job completion)
    totalInspections: integer('total_inspections').notNull().default(0),
    totalFixJobs:     integer('total_fix_jobs').notNull().default(0),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    slugIdx:     index('workshops_slug_idx').on(table.slug),
    adminIdx:    index('workshops_admin_idx').on(table.adminId),
    statusIdx:   index('workshops_status_idx').on(table.status),
    featuredIdx: index('workshops_featured_idx').on(table.featured),
    cityIdx:     index('workshops_city_idx').on(table.city),
  }),
);

// ============================================================
// WORKSHOP MEMBERS
// Maps fixers to workshops. A fixer belongs to at most one
// APPROVED workshop at a time (enforced in service layer).
// ============================================================

export const workshopMembers = pgTable(
  'workshop_members',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    workshopId: uuid('workshop_id')
      .notNull()
      .references(() => workshops.id, { onDelete: 'cascade' }),
    fixerId:   uuid('fixer_id').notNull(),   // cross-service ref (auth-service)

    status:          membershipStatusEnum('status').notNull().default('PENDING'),
    joinRequestNote: text('join_request_note'),   // fixer's application message
    rejectionReason: text('rejection_reason'),
    approvedBy:      uuid('approved_by'),          // admin user ID

    joinedAt: timestamp('joined_at'),              // set when status → APPROVED
    leftAt:   timestamp('left_at'),                // set when status → LEFT

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    workshopIdx: index('workshop_members_workshop_idx').on(table.workshopId),
    fixerIdx:    index('workshop_members_fixer_idx').on(table.fixerId),
    statusIdx:   index('workshop_members_status_idx').on(table.status),
  }),
);

// ============================================================
// RELATIONS
// ============================================================

export const workshopsRelations = relations(workshops, ({ many }) => ({
  members: many(workshopMembers),
}));

export const workshopMembersRelations = relations(workshopMembers, ({ one }) => ({
  workshop: one(workshops, {
    fields: [workshopMembers.workshopId],
    references: [workshops.id],
  }),
}));

// ============================================================
// INFERRED TYPES
// ============================================================

export type Workshop         = typeof workshops.$inferSelect;
export type NewWorkshop      = typeof workshops.$inferInsert;
export type WorkshopMember   = typeof workshopMembers.$inferSelect;
export type NewWorkshopMember = typeof workshopMembers.$inferInsert;
export type WorkshopStatus   = 'PENDING_APPROVAL' | 'ACTIVE' | 'SUSPENDED';
export type MembershipStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'LEFT';