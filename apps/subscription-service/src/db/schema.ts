import {
  pgTable, uuid, varchar, text, boolean,
  timestamp, pgEnum, index, integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================
// ENUMS
// ============================================================

export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'FREE',
  'PRO',
  'WORKSHOP',
]);

export const billingIntervalEnum = pgEnum('billing_interval', [
  'MONTHLY',
  'YEARLY',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'ACTIVE',
  'PAST_DUE',     // Payment failed but grace period still running
  'CANCELLED',    // Ends at period end
  'EXPIRED',      // Period ended
  'TRIALING',     // In free trial
]);

// ============================================================
// SUBSCRIPTIONS TABLE
// One row per user. Updated whenever Stripe sends a webhook.
// ============================================================

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Cross-service reference — user lives in auth-service DB
    userId: uuid('user_id').notNull().unique(),

    // Current plan
    tier: subscriptionTierEnum('tier').notNull().default('FREE'),
    status: subscriptionStatusEnum('status').notNull().default('ACTIVE'),
    billingInterval: billingIntervalEnum('billing_interval'),

    // Stripe identifiers — used to manage the subscription via API
    stripeCustomerId:     varchar('stripe_customer_id', { length: 255 }).unique(),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),
    stripePriceId:        varchar('stripe_price_id', { length: 255 }),

    // Billing period
    currentPeriodStart: timestamp('current_period_start'),
    currentPeriodEnd:   timestamp('current_period_end'),
    cancelAtPeriodEnd:  boolean('cancel_at_period_end').notNull().default(false),
    trialEndsAt:        timestamp('trial_ends_at'),

    // Usage limits (enforced by feature gates)
    vehiclesAllowed:    integer('vehicles_allowed').notNull().default(1),
    inspectionsPerMonth: integer('inspections_per_month').notNull().default(3),
    fixersAllowed:      integer('fixers_allowed').notNull().default(1),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx:     index('subscriptions_user_idx').on(table.userId),
    stripeSubIdx: index('subscriptions_stripe_sub_idx').on(table.stripeSubscriptionId),
    statusIdx:   index('subscriptions_status_idx').on(table.status),
  }),
);

// ============================================================
// BILLING EVENTS TABLE
// Immutable log of every Stripe webhook received.
// Allows replaying events and auditing payment history.
// ============================================================

export const billingEvents = pgTable(
  'billing_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id'),

    // Stripe event data
    stripeEventId:   varchar('stripe_event_id', { length: 255 }).notNull().unique(),
    stripeEventType: varchar('stripe_event_type', { length: 100 }).notNull(),

    // The raw event payload — stored for debugging and replay
    payload: text('payload').notNull(),

    // Processing state
    processed:   boolean('processed').notNull().default(false),
    processedAt: timestamp('processed_at'),
    error:       text('error'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    stripeEventIdx: index('billing_events_stripe_event_idx').on(table.stripeEventId),
    userIdx:        index('billing_events_user_idx').on(table.userId),
    processedIdx:   index('billing_events_processed_idx').on(table.processed),
  }),
);

// ============================================================
// RELATIONS
// ============================================================

export const subscriptionsRelations = relations(subscriptions, ({ many }) => ({
  billingEvents: many(billingEvents),
}));

// ============================================================
// PLAN LIMITS LOOKUP
// Single source of truth for what each tier allows.
// Checked by the feature gate middleware.
// ============================================================

export const PLAN_LIMITS = {
  FREE: {
    vehiclesAllowed: 1,
    inspectionsPerMonth: 3,
    fixersAllowed: 1,
    canExportReports: false,
    canAccessObd: false,
    canAccessAiSummary: false,
  },
  PRO: {
    vehiclesAllowed: 5,
    inspectionsPerMonth: 30,
    fixersAllowed: 1,
    canExportReports: true,
    canAccessObd: true,
    canAccessAiSummary: true,
  },
  WORKSHOP: {
    vehiclesAllowed: -1,       // unlimited
    inspectionsPerMonth: -1,   // unlimited
    fixersAllowed: -1,         // unlimited
    canExportReports: true,
    canAccessObd: true,
    canAccessAiSummary: true,
  },
} as const;

export type SubscriptionTier = keyof typeof PLAN_LIMITS;
export type PlanLimits = typeof PLAN_LIMITS[SubscriptionTier];
export type Subscription = typeof subscriptions.$inferSelect;
export type BillingEvent = typeof billingEvents.$inferSelect;