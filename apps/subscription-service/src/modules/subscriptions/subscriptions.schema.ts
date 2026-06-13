import { z } from 'zod';

// ============================================================
// CREATE CHECKOUT SESSION
// Frontend calls this to start a Stripe checkout flow.
// Stripe redirects back to the app after payment.
// ============================================================

export const createCheckoutSchema = z.object({
  tier: z.enum(['PRO', 'WORKSHOP']),
  billingInterval: z.enum(['MONTHLY', 'YEARLY']),
});

// ============================================================
// CREATE BILLING PORTAL SESSION
// Lets the user manage their subscription (cancel, update
// payment method, view invoices) via Stripe's hosted portal.
// ============================================================

export const createPortalSessionSchema = z.object({
  returnUrl: z.string().url().optional(),
});

// ============================================================
// CANCEL SUBSCRIPTION
// ============================================================

export const cancelSubscriptionSchema = z.object({
  immediately: z.boolean().default(false),
  // true  = cancel right now (lose remaining days)
  // false = cancel at period end (default, user keeps access until paid period ends)
});

// ============================================================
// INFERRED TYPES
// ============================================================

export type CreateCheckoutInput   = z.infer<typeof createCheckoutSchema>;
export type CreatePortalInput     = z.infer<typeof createPortalSessionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;