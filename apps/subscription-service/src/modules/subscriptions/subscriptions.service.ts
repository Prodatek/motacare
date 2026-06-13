import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db } from '../../db';
import {
  subscriptions, billingEvents,
  PLAN_LIMITS,
  type Subscription, type SubscriptionTier,
} from '../../db/schema';
import { env } from '../../config/env';
import type { CreateCheckoutInput, CancelSubscriptionInput } from './subscriptions.schema';

// ============================================================
// STRIPE CLIENT — single instance
// ============================================================

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-04-10',
});

// ============================================================
// PRICE ID MAP
// Maps (tier + interval) → Stripe price ID from env.
// ============================================================

function getPriceId(tier: 'PRO' | 'WORKSHOP', interval: 'MONTHLY' | 'YEARLY'): string {
  const map: Record<string, string> = {
    'PRO:MONTHLY':       env.STRIPE_PRICE_PRO_MONTHLY,
    'PRO:YEARLY':        env.STRIPE_PRICE_PRO_YEARLY,
    'WORKSHOP:MONTHLY':  env.STRIPE_PRICE_WORKSHOP_MONTHLY,
    'WORKSHOP:YEARLY':   env.STRIPE_PRICE_WORKSHOP_YEARLY,
  };
  const key = `${tier}:${interval}`;
  const priceId = map[key];
  if (!priceId) throw new Error(`No Stripe price ID configured for ${key}`);
  return priceId;
}

// ============================================================
// CUSTOM ERRORS
// ============================================================

export class NotFoundError extends Error {
  constructor(msg: string) { super(msg); this.name = 'NotFoundError'; }
}
export class ConflictError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ConflictError'; }
}
export class BadRequestError extends Error {
  constructor(msg: string) { super(msg); this.name = 'BadRequestError'; }
}

// ============================================================
// SUBSCRIPTION SERVICE
// ============================================================

export class SubscriptionService {

  // ----------------------------------------------------------
  // GET SUBSCRIPTION FOR A USER
  // Returns the subscription row, or a synthetic FREE record
  // if the user has never subscribed (so callers never get null).
  // ----------------------------------------------------------

  async getSubscription(userId: string): Promise<Subscription> {
    const existing = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
    });

    if (existing) return existing;

    // Auto-create a FREE subscription for new users
    const [created] = await db
      .insert(subscriptions)
      .values({
        userId,
        tier: 'FREE',
        status: 'ACTIVE',
        vehiclesAllowed:     PLAN_LIMITS.FREE.vehiclesAllowed,
        inspectionsPerMonth: PLAN_LIMITS.FREE.inspectionsPerMonth,
        fixersAllowed:       PLAN_LIMITS.FREE.fixersAllowed,
      })
      .returning();

    return created;
  }

  // ----------------------------------------------------------
  // CREATE CHECKOUT SESSION
  // Returns a Stripe-hosted checkout URL. The user is redirected
  // there to enter payment details. On success, Stripe fires a
  // webhook that we handle to activate the subscription.
  // ----------------------------------------------------------

  async createCheckoutSession(
    userId: string,
    userEmail: string,
    input: CreateCheckoutInput,
  ): Promise<{ url: string }> {

    const sub = await this.getSubscription(userId);

    // Prevent upgrading from an already-active paid plan directly
    // (user should use the billing portal for plan changes)
    if (sub.tier !== 'FREE' && sub.status === 'ACTIVE' && sub.stripeSubscriptionId) {
      throw new ConflictError(
        'You already have an active subscription. Use the billing portal to change your plan.',
      );
    }

    const priceId = getPriceId(input.tier, input.billingInterval);

    // Get or create Stripe customer
    let customerId = sub.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });
      customerId = customer.id;

      // Save the customer ID so we can reuse it
      await db
        .update(subscriptions)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(subscriptions.userId, userId));
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.APP_URL}/dashboard/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${env.APP_URL}/dashboard/subscription?cancelled=true`,
      subscription_data: {
        metadata: { userId, tier: input.tier },
        // 7-day free trial for new subscribers
        trial_period_days: sub.tier === 'FREE' ? 7 : undefined,
      },
      metadata: { userId, tier: input.tier, interval: input.billingInterval },
      allow_promotion_codes: true,
    });

    if (!session.url) throw new Error('Stripe did not return a checkout URL');
    return { url: session.url };
  }

  // ----------------------------------------------------------
  // CREATE BILLING PORTAL SESSION
  // Opens Stripe's hosted portal for subscription management.
  // -------------------------------------------------------

  async createPortalSession(
    userId: string,
    returnUrl?: string,
  ): Promise<{ url: string }> {

    const sub = await this.getSubscription(userId);

    if (!sub.stripeCustomerId) {
      throw new BadRequestError(
        'No billing account found. Subscribe to a paid plan first.',
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: returnUrl ?? `${env.APP_URL}/dashboard/subscription`,
    });

    return { url: session.url };
  }

  // ----------------------------------------------------------
  // CANCEL SUBSCRIPTION
  // ----------------------------------------------------------

  async cancelSubscription(
    userId: string,
    input: CancelSubscriptionInput,
  ): Promise<Subscription> {

    const sub = await this.getSubscription(userId);

    if (sub.tier === 'FREE' || !sub.stripeSubscriptionId) {
      throw new BadRequestError('No active paid subscription to cancel.');
    }
    if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') {
      throw new ConflictError('Subscription is already cancelled.');
    }

    if (input.immediately) {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    } else {
      // Cancel at period end — user keeps access until paid period expires
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    const [updated] = await db
      .update(subscriptions)
      .set({
        status: input.immediately ? 'CANCELLED' : 'ACTIVE',
        cancelAtPeriodEnd: !input.immediately,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .returning();

    return updated;
  }

  // ----------------------------------------------------------
  // APPLY WEBHOOK EVENT
  // Called by the webhook handler after verifying Stripe signature.
  // Updates the subscription row based on the event type.
  // ----------------------------------------------------------

  async applyWebhookEvent(event: Stripe.Event): Promise<void> {
    // Idempotency check — skip already-processed events
    const existing = await db.query.billingEvents.findFirst({
      where: eq(billingEvents.stripeEventId, event.id),
    });
    if (existing?.processed) return;

    // Log the raw event first (even if processing fails, we have the record)
    const [logged] = await db
      .insert(billingEvents)
      .values({
        stripeEventId:   event.id,
        stripeEventType: event.type,
        payload:         JSON.stringify(event.data.object),
        userId:          this.extractUserId(event),
      })
      .onConflictDoNothing()
      .returning();

    try {
      await this.processEvent(event);

      // Mark as processed
      await db
        .update(billingEvents)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(billingEvents.stripeEventId, event.id));

    } catch (err: any) {
      // Record the error but don't re-throw — Stripe retries if we return non-2xx
      await db
        .update(billingEvents)
        .set({ error: err.message })
        .where(eq(billingEvents.stripeEventId, event.id));
      throw err; // re-throw so the webhook handler returns 500 → Stripe retries
    }
  }

  // ----------------------------------------------------------
  // PROCESS EVENT — maps Stripe event types to DB updates
  // ----------------------------------------------------------

  private async processEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {

      // Subscription created or updated (plan change, renewal)
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as Stripe.Subscription;
        const userId = stripeSub.metadata?.userId;
        if (!userId) return;

        const tier = (stripeSub.metadata?.tier as SubscriptionTier) ?? 'FREE';
        const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.FREE;

        await db
          .update(subscriptions)
          .set({
            tier,
            status:               this.mapStripeStatus(stripeSub.status),
            stripeSubscriptionId: stripeSub.id,
            stripePriceId:        stripeSub.items.data[0]?.price.id,
            currentPeriodStart:   new Date(stripeSub.current_period_start * 1000),
            currentPeriodEnd:     new Date(stripeSub.current_period_end * 1000),
            cancelAtPeriodEnd:    stripeSub.cancel_at_period_end,
            trialEndsAt: stripeSub.trial_end
              ? new Date(stripeSub.trial_end * 1000)
              : null,
            vehiclesAllowed:      limits.vehiclesAllowed,
            inspectionsPerMonth:  limits.inspectionsPerMonth,
            fixersAllowed:        limits.fixersAllowed,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.userId, userId));
        break;
      }

      // Subscription cancelled (either immediately or at period end)
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as Stripe.Subscription;
        const userId = stripeSub.metadata?.userId;
        if (!userId) return;

        // Downgrade back to FREE limits on cancellation
        await db
          .update(subscriptions)
          .set({
            tier:                'FREE',
            status:              'EXPIRED',
            stripeSubscriptionId: null,
            stripePriceId:       null,
            cancelAtPeriodEnd:   false,
            vehiclesAllowed:     PLAN_LIMITS.FREE.vehiclesAllowed,
            inspectionsPerMonth: PLAN_LIMITS.FREE.inspectionsPerMonth,
            fixersAllowed:       PLAN_LIMITS.FREE.fixersAllowed,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.userId, userId));
        break;
      }

      // Payment failed — mark as past due but don't remove access yet
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = (invoice.subscription_details?.metadata?.userId) as string | undefined;
        if (!userId) return;

        await db
          .update(subscriptions)
          .set({ status: 'PAST_DUE', updatedAt: new Date() })
          .where(eq(subscriptions.userId, userId));
        break;
      }

      // Payment succeeded — restore active status if past due
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const userId = (invoice.subscription_details?.metadata?.userId) as string | undefined;
        if (!userId) return;

        await db
          .update(subscriptions)
          .set({ status: 'ACTIVE', updatedAt: new Date() })
          .where(eq(subscriptions.userId, userId));
        break;
      }

      default:
        // Unhandled event type — log but don't error
        console.log(`[subscriptions] Unhandled Stripe event: ${event.type}`);
    }
  }

  // ----------------------------------------------------------
  // HELPERS
  // ----------------------------------------------------------

  private mapStripeStatus(
    stripeStatus: Stripe.Subscription.Status,
  ): 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'TRIALING' {
    const map: Record<Stripe.Subscription.Status, 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'TRIALING'> = {
      active:             'ACTIVE',
      trialing:           'TRIALING',
      past_due:           'PAST_DUE',
      canceled:           'CANCELLED',
      unpaid:             'PAST_DUE',
      incomplete:         'PAST_DUE',
      incomplete_expired: 'EXPIRED',
      paused:             'PAST_DUE',
    };
    return map[stripeStatus] ?? 'ACTIVE';
  }

  private extractUserId(event: Stripe.Event): string | undefined {
    const obj = event.data.object as any;
    return obj?.metadata?.userId ?? obj?.subscription_details?.metadata?.userId;
  }
}