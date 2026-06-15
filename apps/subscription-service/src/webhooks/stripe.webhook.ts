import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { SubscriptionService } from '../modules/subscriptions/subscriptions.service';
import { env, isStripeConfigured } from '../config/env';

const service = new SubscriptionService();

// ============================================================
// STRIPE WEBHOOK HANDLER
//
// Two bugs fixed from the previous version:
//
// 1. `new Stripe(env.STRIPE_SECRET_KEY, ...)` at module-load time
//    THREW when STRIPE_SECRET_KEY was empty — crashing the whole
//    service before it could even start listening. The client
//    is now created lazily, only when a real webhook arrives.
//
// 2. `fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, ...)`
//    was called on the ROOT Fastify instance. Content-type parsers
//    in Fastify are NOT automatically scoped — calling this on the
//    root instance overrides JSON parsing for EVERY route in the
//    service, not just this one. That's why /internal/check-limit
//    and /subscriptions/checkout were receiving `request.body` as
//    a raw Buffer instead of a parsed object, and returning
//    "userId, resource, and currentCount are required" even when
//    the caller sent valid JSON.
//
//    FIX: register this handler inside `fastify.register(async (instance) => {...})`.
//    Fastify plugins registered this way get their OWN encapsulated
//    context — addContentTypeParser calls inside it do NOT leak to
//    sibling routes registered on the parent instance.
// ============================================================

export async function registerStripeWebhook(fastify: FastifyInstance) {

  // If Stripe isn't configured, register a stub that explains why
  // instead of a route that would crash on first use.
  if (!isStripeConfigured) {
    fastify.post('/webhooks/stripe', async (_req, reply: FastifyReply) => {
      return reply.status(503).send({
        statusCode: 503,
        error: 'Billing Not Configured',
        message: 'STRIPE_WEBHOOK_SECRET is not set on this server.',
      });
    });
    return;
  }

  // Encapsulated child context — addContentTypeParser here is
  // scoped to ONLY this plugin, not the whole app.
  await fastify.register(async (instance: FastifyInstance) => {

    instance.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer' },
      (_req, body, done) => done(null, body),
    );

    instance.post('/webhooks/stripe', async (request: FastifyRequest, reply: FastifyReply) => {
      const signature = request.headers['stripe-signature'];

      if (!signature) {
        return reply.status(400).send({ error: 'Missing stripe-signature header' });
      }

      // Lazy client — only constructed when a webhook actually arrives
      const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(
          request.body as Buffer,
          signature,
          env.STRIPE_WEBHOOK_SECRET,
        );
      } catch (err: any) {
        console.error('[stripe-webhook] Signature verification failed:', err.message);
        return reply.status(400).send({ error: `Webhook verification failed: ${err.message}` });
      }

      console.log(`[stripe-webhook] Received event: ${event.type} (${event.id})`);

      try {
        await service.applyWebhookEvent(event);
        return reply.status(200).send({ received: true });
      } catch (err: any) {
        console.error(`[stripe-webhook] Failed to process ${event.type}:`, err.message);
        return reply.status(500).send({ error: 'Event processing failed' });
      }
    });
  });
}