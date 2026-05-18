import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

// ============================================================
// ENUMS
// ============================================================

export const userRoleEnum = pgEnum('user_role', ['OWNER', 'FIXER', 'ADMIN']);

export const subscriptionTierEnum = pgEnum('subscription_tier', ['FREE', 'PRO', 'WORKSHOP']);

// ============================================================
// USERS TABLE
// ============================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Identity
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),

    // Profile
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 20 }),

    // Role & subscription
    role: userRoleEnum('role').notNull().default('OWNER'),
    subscriptionTier: subscriptionTierEnum('subscription_tier').notNull().default('FREE'),

    // Fixer-specific fields
    workshopName: varchar('workshop_name', { length: 200 }),
    workshopAddress: text('workshop_address'),

    // Account state
    isActive: boolean('is_active').notNull().default(true),
    isEmailVerified: boolean('is_email_verified').notNull().default(false),
    emailVerificationToken: varchar('email_verification_token', { length: 255 }),

    // Timestamps
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at'),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
  }),
);

// ============================================================
// REFRESH TOKENS TABLE
// Stored in DB so we can revoke them (logout, security events)
// ============================================================

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 512 }).notNull().unique(),
    isRevoked: boolean('is_revoked').notNull().default(false),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),

    // Track device/session for security
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
  },
  (table) => ({
    userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
    tokenIdx: index('refresh_tokens_token_idx').on(table.token),
  }),
);

// ============================================================
// TYPES — Inferred from schema (used across the service)
// ============================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
export type UserRole = 'OWNER' | 'FIXER' | 'ADMIN';
export type SubscriptionTier = 'FREE' | 'PRO' | 'WORKSHOP';