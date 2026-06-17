import {
  pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
 
// ── ENUMS ────────────────────────────────────────────────────
 
export const userRoleEnum = pgEnum('user_role', [
  'OWNER',
  'FIXER',
  'WORKSHOP_ADMIN',  // ← NEW: fixer who administers a workshop
  'ADMIN',
]);
 
export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'FREE',
  'PRO',
  'WORKSHOP',
]);
 
// ── USERS TABLE ──────────────────────────────────────────────
 
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
 
    email:        varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
 
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName:  varchar('last_name', { length: 100 }).notNull(),
    phone:     varchar('phone', { length: 20 }),
 
    role:             userRoleEnum('role').notNull().default('OWNER'),
    subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('FREE'),
 
    // Fixer fields
    // workshopId — cross-service FK to workshop-service DB (no constraint enforced here)
    // Set by workshop-service via /auth/internal/update-user-role when fixer joins/leaves
    workshopId:      uuid('workshop_id'),
    workshopName:    varchar('workshop_name', { length: 200 }),      // kept for solo fixers
    workshopAddress: text('workshop_address'),
 
    isActive:               boolean('is_active').notNull().default(true),
    isEmailVerified:        boolean('is_email_verified').notNull().default(false),
    emailVerificationToken: varchar('email_verification_token', { length: 255 }),
 
    createdAt:   timestamp('created_at').notNull().defaultNow(),
    updatedAt:   timestamp('updated_at').notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at'),
  },
  (table) => ({
    emailIdx:      index('users_email_idx').on(table.email),
    roleIdx:       index('users_role_idx').on(table.role),
    workshopIdx:   index('users_workshop_idx').on(table.workshopId),
  }),
);
 
// ── REFRESH TOKENS ───────────────────────────────────────────
 
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id:        uuid('id').primaryKey().defaultRandom(),
    userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token:     varchar('token', { length: 512 }).notNull().unique(),
    isRevoked: boolean('is_revoked').notNull().default(false),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
  },
  (table) => ({
    userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
    tokenIdx:  index('refresh_tokens_token_idx').on(table.token),
  }),
);
 
// ── RELATIONS ────────────────────────────────────────────────
 
export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
}));
 
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));
 
// ── INFERRED TYPES ───────────────────────────────────────────
 
export type User              = typeof users.$inferSelect;
export type NewUser           = typeof users.$inferInsert;
export type RefreshToken      = typeof refreshTokens.$inferSelect;
export type NewRefreshToken   = typeof refreshTokens.$inferInsert;
export type UserRole          = 'OWNER' | 'FIXER' | 'WORKSHOP_ADMIN' | 'ADMIN';
export type SubscriptionTier  = 'FREE' | 'PRO' | 'WORKSHOP';