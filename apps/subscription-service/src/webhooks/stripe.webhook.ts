import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { SubscriptionService } from '../modules/subscriptions/subscriptions.service';
import { env } from '../config/env';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
const service = new SubscriptionService();

// ============================================================
// STRIPE WEBHOOK HANDLER
//
// IMPORTANT: Fastify must receive the raw body (Buffer) for
// Stripe signature verification to work. The route must be
// registered BEFORE any JSON body parser is added, and must
// use addContentTypeParser to capture the raw bytes.
//
// The webhook endpoint is NOT authenticated with JWT —
// it is authenticated via Stripe signature.
// ============================================================

export async function registerStripeWebhook(fastify: FastifyInstance) {

  // Tell Fastify to give us the raw Buffer for this route
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    function (_req, body, done) {
      done(null, body);
    },
  );

  fastify.post('/webhooks/stripe', async (request: FastifyRequest, reply: FastifyReply) => {
    const signature = request.headers['stripe-signature'];

    if (!signature) {
      return reply.status(400).send({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;

    try {
      // Verify the event came from Stripe — not a spoofed request
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
      // Return 200 immediately — Stripe retries if it doesn't get 2xx
      return reply.status(200).send({ received: true });
    } catch (err: any) {
      console.error(`[stripe-webhook] Failed to process ${event.type}:`, err.message);
      // Return 500 so Stripe retries the event
      return reply.status(500).send({ error: 'Event processing failed' });
    }
  });
}